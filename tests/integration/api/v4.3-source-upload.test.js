// Integration tests for v4.3.0 Stage 1 — POST /api/generation/sources.
//
// Requires: func start running against the TEST Cosmos (see CLAUDE.md's Testing section) with
// source_materials provisioned (docs/azure/V430_CONTAINERS_SETUP.md), B2C_ALLOW_UNVERIFIED_DEV=true.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/v4.3-source-upload.test.js

const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const JSZip = require('jszip');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;

const TEACHER = 'v43-upload-teacher';

function authHeaders(oid) {
  const token = jwt.sign({ oid, name: 'Integration Teacher' }, 'dev-key', { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

async function buildPdf(pagesText) {
  const doc = new PDFDocument();
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(res => doc.on('end', res));
  pagesText.forEach((text, i) => {
    if (i > 0) doc.addPage();
    doc.text(text);
  });
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

async function buildDocx(text) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.folder('word').file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

const LONG_TEXT = 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose. Chlorophyll in the chloroplast absorbs sunlight, and carbon dioxide and water are combined to produce glucose and oxygen. This process occurs mainly in the leaves of green plants and is essential for life on Earth.';

function multipartBody(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value && value.buffer) form.append(key, new Blob([value.buffer]), value.filename);
    else form.append(key, value);
  }
  return form;
}

describe('POST /api/generation/sources', () => {
  it_int('rejects unauthenticated requests with 401', async () => {
    const form = multipartBody({ attested: 'true', file: { buffer: Buffer.from('x'.repeat(300)), filename: 'a.txt' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', body: form });
    expect(res.status).toBe(401);
  });

  it_int('rejects a missing attestation with 400', async () => {
    const form = multipartBody({ file: { buffer: Buffer.from('x'.repeat(300)), filename: 'a.txt' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(TEACHER), body: form });
    expect(res.status).toBe(400);
  });

  it_int('a valid PDF upload returns 201 with chunk/page metadata', async () => {
    const pdfBuf = await buildPdf([LONG_TEXT, LONG_TEXT]);
    const form = multipartBody({ attested: 'true', file: { buffer: pdfBuf, filename: 'bio.pdf' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(TEACHER), body: form });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.kind).toBe('pdf');
    expect(body.pageCount).toBe(2);
    expect(body.chunkCount).toBeGreaterThan(0);
  });

  it_int('a valid docx upload returns 201', async () => {
    const docxBuf = await buildDocx(LONG_TEXT);
    const form = multipartBody({ attested: 'true', file: { buffer: docxBuf, filename: 'bio.docx' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(TEACHER), body: form });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.kind).toBe('docx');
    expect(body.pageCount).toBeNull();
  });

  it_int('a valid txt upload returns 201', async () => {
    const form = multipartBody({ attested: 'true', file: { buffer: Buffer.from(LONG_TEXT, 'utf-8'), filename: 'bio.txt' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(TEACHER), body: form });
    expect(res.status).toBe(201);
    expect((await res.json()).kind).toBe('txt');
  });

  it_int('too-short extracted text (scanned doc) returns 400', async () => {
    const form = multipartBody({ attested: 'true', file: { buffer: Buffer.from('hi', 'utf-8'), filename: 'short.txt' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(TEACHER), body: form });
    expect(res.status).toBe(400);
  });

  it_int('a file over 15MB is rejected with 413', async () => {
    const bigBuf = Buffer.alloc(16 * 1024 * 1024, 0x41);
    const form = multipartBody({ attested: 'true', file: { buffer: bigBuf, filename: 'big.txt' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(TEACHER), body: form });
    expect(res.status).toBe(413);
  });

  it_int('an unrecognised binary file returns 400', async () => {
    const garbage = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x10, 0x20]);
    const form = multipartBody({ attested: 'true', file: { buffer: garbage, filename: 'weird.bin' } });
    const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(TEACHER), body: form });
    expect(res.status).toBe(400);
  });

  it_int('the 11th upload in a day is rejected with 429', async () => {
    const uniqueTeacher = `v43-quota-teacher-${Date.now()}`;
    let lastStatus;
    for (let i = 0; i < 11; i++) {
      const form = multipartBody({ attested: 'true', file: { buffer: Buffer.from(LONG_TEXT, 'utf-8'), filename: `f${i}.txt` } });
      const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(uniqueTeacher), body: form });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  }, 30000);
});
