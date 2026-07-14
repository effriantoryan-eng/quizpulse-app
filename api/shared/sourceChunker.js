// Pure chunking logic for uploaded source materials (v4.3.0 AI quiz generation).
// Chunk index is the universal addressing unit for sourceRef (§3.2 of the CEO review addendum) —
// PDFs additionally carry a chunk->page map; docx/txt chunks have no real pages (pagination there
// is a renderer artifact, not a document property).

const MAX_CHUNK_CHARS = 2000;
const MAX_TOTAL_CHARS = 300000; // global cap across the whole source, per the addendum §3.9 family

// Splits one page's text into <= MAX_CHUNK_CHARS pieces on paragraph boundaries where possible,
// falling back to a hard slice for a single huge paragraph.
function splitIntoPieces(text, maxChars) {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const pieces = [];
  let current = '';
  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) pieces.push(current);
    if (para.length <= maxChars) {
      current = para;
    } else {
      // A single paragraph longer than the cap — hard-slice it.
      for (let i = 0; i < para.length; i += maxChars) pieces.push(para.slice(i, i + maxChars));
      current = '';
    }
  }
  if (current) pieces.push(current);
  return pieces.length > 0 ? pieces : (text.trim() ? [text.trim()] : []);
}

// PDF path: pages is string[] (one entry per page, from unpdf's extractText mergePages:false).
// Chunks never span two pages — an overlong page splits into multiple chunks sharing that page
// number, so the resulting chunk->page map is always exact, never approximate.
function chunkPages(pages) {
  const chunks = [];
  let totalChars = 0;
  let truncated = false;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    if (truncated) break;
    const pageNumber = pageIdx + 1;
    const pieces = splitIntoPieces(pages[pageIdx] || '', MAX_CHUNK_CHARS);
    for (const piece of pieces) {
      if (totalChars + piece.length > MAX_TOTAL_CHARS) { truncated = true; break; }
      chunks.push({ index: chunks.length, page: pageNumber, text: piece });
      totalChars += piece.length;
    }
  }
  return { chunks, truncated, pageCount: pages.length };
}

// docx/txt path: text is one big string. No page concept — split into section-sized chunks on
// paragraph boundaries only.
function chunkText(text) {
  const pieces = splitIntoPieces(text || '', MAX_CHUNK_CHARS);
  const chunks = [];
  let totalChars = 0;
  let truncated = false;
  for (const piece of pieces) {
    if (totalChars + piece.length > MAX_TOTAL_CHARS) { truncated = true; break; }
    chunks.push({ index: chunks.length, text: piece });
    totalChars += piece.length;
  }
  return { chunks, truncated };
}

// First ~6 words of a chunk, for the E4/§6.10 range-picker section preview list.
function chunkPreview(chunkText_) {
  const words = chunkText_.trim().split(/\s+/).slice(0, 6);
  return words.join(' ') + (chunkText_.trim().split(/\s+/).length > 6 ? '…' : '');
}

module.exports = { chunkPages, chunkText, chunkPreview, MAX_CHUNK_CHARS, MAX_TOTAL_CHARS };
