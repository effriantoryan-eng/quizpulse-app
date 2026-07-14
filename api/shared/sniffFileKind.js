// Magic-byte MIME sniffing for uploaded source documents (v4.3.0 AI quiz generation). Pure, no
// Cosmos dependency — kept separate from api/generationSources.js so it's unit-testable without
// constructing a CosmosClient (that endpoint module builds one at require-time, same convention
// as every other Functions v4 handler in this codebase).
function sniffKind(buf) {
  if (buf.length >= 5 && buf.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx';
  // No magic bytes for plain text — valid UTF-8 is the bar.
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return 'txt';
  } catch (_) {
    return null;
  }
}

module.exports = { sniffKind };
