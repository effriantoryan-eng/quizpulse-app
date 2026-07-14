// Deterministic id derivation + sourceRef label resolution for v4.3.0 draft approval and E3
// spaced-repeat clones. Deterministic ids make materialisation retry-safe: a failed approve or
// send that partially wrote docs can be retried, and the same input always produces the same id,
// so retried writes 409 (tolerated) instead of duplicating.

const crypto = require('crypto');

function deterministicId(...parts) {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex').slice(0, 32);
}

function questionIdForDraft(draftId, index) {
  return deterministicId('ai-question', draftId, index);
}

function quizIdForDraft(draftId) {
  return deterministicId('ai-quiz', draftId);
}

function cloneIdForQuiz(parentQuizId, offsetIndex) {
  return deterministicId('spaced-repeat-clone', parentQuizId, offsetIndex);
}

// Resolves a chunk index (or the first of several) to a display label using the source's
// chunk->page map, snapshotted onto the draft at creation time (§5.6 — resolved at approve time
// so Analytics/the drill-down never need a source read on the hot, 3s-polled path).
// chunkPageMap: { [chunkIndex]: pageNumber|null }
function resolveSourceRefLabel(sourceRef, chunkPageMap, kind) {
  if (!Array.isArray(sourceRef) || sourceRef.length === 0) return null;
  if (kind === 'pdf') {
    const pages = [...new Set(sourceRef.map(ci => chunkPageMap[ci]).filter(p => p != null))].sort((a, b) => a - b);
    if (pages.length === 0) return null;
    if (pages.length === 1) return `page ${pages[0]}`;
    return `pages ${pages[0]}-${pages[pages.length - 1]}`;
  }
  // docx/txt — no real pages, label by chunk (section) position.
  const first = sourceRef[0];
  return `section ${first + 1}`;
}

module.exports = { deterministicId, questionIdForDraft, quizIdForDraft, cloneIdForQuiz, resolveSourceRefLabel };
