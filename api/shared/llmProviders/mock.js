// Mock LLM provider (v4.3.0 default, LLM_PROVIDER=mock) — the sprint must run and pass tests
// with NO real LLM API key. Deterministic (seeded from sourceId) so the same document always
// produces the same draft, which keeps tests and demos reproducible.
//
// Hard constraint (CEO review addendum §3.4): must NEVER reproduce a verbatim source sentence.
// This builds questions entirely from single short extracted terms dropped into a fixed template
// — it never concatenates consecutive source words, so there is no verbatim-reproduction surface
// at all, by construction (not just by accident).

const { seededRng, seededShuffle } = require('../seededRandom');

const STOPWORDS = new Set([
  'about', 'after', 'again', 'along', 'their', 'there', 'these', 'those', 'which', 'while',
  'would', 'could', 'should', 'because', 'before', 'between', 'through', 'during', 'other',
  'where', 'being', 'still', 'every', 'often', 'never', 'always', 'first', 'second', 'third',
  'these', 'this', 'that', 'from', 'have', 'with', 'they', 'will', 'when', 'what', 'were',
]);

class InsufficientContentError extends Error {}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Single-word candidate terms only — the deliberate choice that keeps the no-verbatim guarantee
// structural: a template built from single words can never reproduce an 8-word source run.
function extractKeyTerms(text, maxPerChunk = 6) {
  const seen = new Set();
  const terms = [];
  const matches = (text || '').match(/[A-Za-z][A-Za-z-]{4,}/g) || [];
  for (const raw of matches) {
    const lower = raw.toLowerCase();
    if (STOPWORDS.has(lower) || seen.has(lower)) continue;
    seen.add(lower);
    terms.push(raw);
    if (terms.length >= maxPerChunk) break;
  }
  return terms;
}

// chunks: [{ index, page?, text }] already selected by the adapter (range or even sampling).
function generate({ sourceId, chunks, questionCount, topicTag }) {
  const rng = seededRng(sourceId);

  const termPool = [];
  const seenLower = new Set();
  for (const chunk of chunks) {
    for (const term of extractKeyTerms(chunk.text)) {
      const lower = term.toLowerCase();
      if (seenLower.has(lower)) continue;
      seenLower.add(lower);
      termPool.push({ term, chunkIndex: chunk.index });
    }
  }

  if (termPool.length < 4) {
    throw new InsufficientContentError('Not enough distinct content in this document to draft questions');
  }

  const order = seededShuffle(termPool, rng);
  const questions = [];
  for (let i = 0; i < questionCount; i++) {
    const anchor = order[i % order.length];
    const others = termPool.filter(t => t.term.toLowerCase() !== anchor.term.toLowerCase());
    const distractors = seededShuffle(others, rng).slice(0, 3);

    const optionTerms = [anchor.term, ...distractors.map(d => d.term)];
    const shuffledPositions = seededShuffle([0, 1, 2, 3], rng);
    const options = shuffledPositions.map(pos => optionTerms[pos]);
    const correctIndex = shuffledPositions.indexOf(0);

    questions.push({
      text: `According to the document, which of the following is most closely associated with "${capitalize(anchor.term)}"?`,
      options,
      correctIndex,
      sourceRef: [anchor.chunkIndex],
      ...(topicTag ? { topicTag } : {}),
    });
  }

  return {
    questions,
    usedChunkIndexes: [...new Set(chunks.map(c => c.index))],
  };
}

module.exports = { generate, extractKeyTerms, InsufficientContentError };
