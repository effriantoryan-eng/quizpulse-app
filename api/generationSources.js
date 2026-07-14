// POST /api/generation/sources — upload a source document for AI quiz generation (v4.3.0).
// Multipart upload (per the T9/task-0 spike — verified locally via request.formData(), see
// docs/azure/V430_CONTAINERS_SETUP.md). The original binary is NEVER persisted — only extracted
// text + chunk metadata, per the sprint's copyright/privacy constraint.

const crypto = require('crypto');
const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');
const { rateLimit, getClientIp } = require('./rateLimit');
const { logRequest } = require('./logger');
const { authenticateTeacher } = require('./auth');
const { countCreatedToday } = require('./shared/dailyQuota');
const { chunkPages, chunkText, chunkPreview } = require('./shared/sourceChunker');
const { sniffKind } = require('./shared/sniffFileKind');
const { extractText, getDocumentProxy } = require('unpdf');
const mammoth = require('mammoth');

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });
const database = client.database(process.env.COSMOS_DATABASE);
const sourcesContainer = database.container(process.env.COSMOS_CONTAINER_SOURCE_MATERIALS || 'source_materials');

const MAX_FILE_BYTES = 15 * 1024 * 1024; // Security limits — 15MB upload cap
const MAX_PAGES = 200;
const MIN_EXTRACTED_CHARS = 200;
const EXTRACTION_TIMEOUT_MS = 10000;
const MAX_STORED_SOURCES = 20; // Security limits — Stored sources per teacher
const MAX_UPLOADS_PER_DAY = 10; // Security limits — Source uploads per teacher/day
const SECTION_PREVIEW_CAP = 40; // enough for a scrollable range picker without a huge payload

// A file with no readable text — passed to a name so the same message applies across formats.
class UnreadableFileError extends Error {}
class ScannedDocumentError extends Error {}
class TooManyPagesError extends Error {}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('extraction-timeout')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function extractPdf(buf) {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf));
  } catch (err) {
    throw new UnreadableFileError(err.message);
  }
  let result;
  try {
    result = await extractText(pdf, { mergePages: false });
  } catch (err) {
    throw new UnreadableFileError(err.message);
  }
  const pages = result.text || [];
  if (pages.length > MAX_PAGES) throw new TooManyPagesError();
  const totalChars = pages.join('').trim().length;
  if (totalChars < MIN_EXTRACTED_CHARS) throw new ScannedDocumentError();
  return { pages };
}

async function extractDocx(buf) {
  let result;
  try {
    result = await mammoth.extractRawText({ buffer: buf });
  } catch (err) {
    throw new UnreadableFileError(err.message);
  }
  const text = (result.value || '').trim();
  if (text.length < MIN_EXTRACTED_CHARS) throw new ScannedDocumentError();
  return { text };
}

function extractTxt(buf) {
  const text = buf.toString('utf-8').trim();
  if (text.length < MIN_EXTRACTED_CHARS) throw new ScannedDocumentError();
  return { text };
}

app.http('generationSources', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'generation/sources',
  handler: async (request, context) => {
    const start = Date.now();
    function respond(status, body, teacherId) {
      logRequest(context, { endpoint: 'generation/sources', method: 'POST', status, durationMs: Date.now() - start, teacherId });
      return { status, jsonBody: body };
    }
    try {
      const auth = await authenticateTeacher(request);
      if (auth.error) return respond(auth.status, { error: auth.error });
      const { teacherId } = auth;

      if (!rateLimit(`generation-sources:${getClientIp(request)}`, 30, 60000)) {
        return respond(429, { error: 'Too many requests. Please try again later.' }, teacherId);
      }

      const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_FILE_BYTES + 65536) { // small allowance for multipart framing overhead
        return respond(413, { error: 'File is too large. Maximum size is 15MB.' }, teacherId);
      }

      let form;
      try {
        form = await request.formData();
      } catch (_) {
        return respond(400, { error: 'Request must be a valid multipart form' }, teacherId);
      }

      const attested = form.get('attested');
      if (attested !== 'true') {
        return respond(400, { error: 'You must confirm you have the right to use this document' }, teacherId);
      }

      const file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return respond(400, { error: 'A file is required' }, teacherId);
      }

      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) {
        return respond(413, { error: 'File is too large. Maximum size is 15MB.' }, teacherId);
      }
      if (buf.length === 0) {
        return respond(400, { error: 'The uploaded file is empty' }, teacherId);
      }

      const kind = sniffKind(buf);
      if (!kind) {
        return respond(400, { error: 'Unsupported file type. Upload a PDF, Word document, or plain text file.' }, teacherId);
      }

      // Quotas — checked before the (relatively expensive) extraction work.
      const [storedCount, uploadsToday] = await Promise.all([
        sourcesContainer.items.query({
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid',
          parameters: [{ name: '@tid', value: teacherId }],
        }).fetchAll().then(r => r.resources[0] || 0),
        countCreatedToday(sourcesContainer, teacherId),
      ]);
      if (storedCount >= MAX_STORED_SOURCES) {
        return respond(429, { error: `You can have at most ${MAX_STORED_SOURCES} stored documents. Wait for an older one to expire.` }, teacherId);
      }
      if (uploadsToday >= MAX_UPLOADS_PER_DAY) {
        return respond(429, { error: "You've reached your daily upload limit. Try again tomorrow." }, teacherId);
      }

      let extraction;
      try {
        if (kind === 'pdf') extraction = await withTimeout(extractPdf(buf), EXTRACTION_TIMEOUT_MS);
        else if (kind === 'docx') extraction = await withTimeout(extractDocx(buf), EXTRACTION_TIMEOUT_MS);
        else extraction = extractTxt(buf);
      } catch (err) {
        if (err instanceof TooManyPagesError) {
          return respond(400, { error: `This document is too long — ${MAX_PAGES} pages maximum.` }, teacherId);
        }
        if (err instanceof ScannedDocumentError) {
          return respond(400, { error: 'This looks like a scanned document — we need selectable text.' }, teacherId);
        }
        if (err.message === 'extraction-timeout') {
          return respond(400, { error: "This document took too long to read. Try a smaller file." }, teacherId);
        }
        // UnreadableFileError and anything else in the parse path — same 400 family (§3.8),
        // including encrypted PDFs (unpdf throws a password-required error we don't special-case).
        return respond(400, { error: "We couldn't read this file. It may be corrupted or password protected." }, teacherId);
      }

      const chunkResult = kind === 'pdf' ? chunkPages(extraction.pages) : chunkText(extraction.text);
      const sectionPreviews = chunkResult.chunks.slice(0, SECTION_PREVIEW_CAP).map(c => ({
        index: c.index,
        page: c.page ?? null,
        preview: chunkPreview(c.text),
      }));

      const sourceId = crypto.randomUUID();
      const now = new Date().toISOString();
      const doc = {
        id: sourceId,
        teacherId,
        kind,
        filename: typeof file.name === 'string' ? file.name.slice(0, 200) : 'document',
        pageCount: kind === 'pdf' ? extraction.pages.length : null,
        chunks: chunkResult.chunks,
        chunkCount: chunkResult.chunks.length,
        truncated: chunkResult.truncated,
        createdAt: now,
      };
      await sourcesContainer.items.create(doc);

      return respond(201, {
        sourceId,
        kind,
        pageCount: doc.pageCount,
        chunkCount: doc.chunkCount,
        truncated: doc.truncated,
        sectionPreviews,
      }, teacherId);
    } catch (err) {
      if (err && err.status) return respond(err.status, { error: err.error }, null);
      context.error('generationSources error:', err.message);
      return respond(500, { error: 'An unexpected error occurred' });
    }
  },
});
