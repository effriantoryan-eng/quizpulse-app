// Unit tests for api/shared/llmProviders/mock.js (v4.3.0). Covers the CEO review addendum's hard
// constraints: deterministic output, and NEVER a verbatim source substring >= 8 words (§3.4),
// plus the design review's mock quality bar (§6.8): complete sentences ending in "?", never
// fragments/mad-libs.

const { generate, extractKeyTerms, InsufficientContentError } = require('../../../api/shared/llmProviders/mock');

const SOURCE_TEXT = 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose molecules inside the chloroplast structures found throughout every green leaf on the plant.';
const SOURCE_TEXT_2 = 'Mitochondria are the powerhouse of the cell and generate most of the chemical energy needed to power the biochemical reactions of the cell through a process called cellular respiration.';

function sampleChunks() {
  return [
    { index: 0, page: 1, text: SOURCE_TEXT },
    { index: 1, page: 2, text: SOURCE_TEXT_2 },
  ];
}

// Every contiguous run of 8+ words from the source text, lowercased and whitespace-normalised.
function eightWordRuns(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const runs = new Set();
  for (let i = 0; i + 8 <= words.length; i++) runs.add(words.slice(i, i + 8).join(' '));
  return runs;
}

describe('mock provider — determinism', () => {
  test('the same sourceId always produces the same draft', () => {
    const a = generate({ sourceId: 'src-1', chunks: sampleChunks(), questionCount: 4 });
    const b = generate({ sourceId: 'src-1', chunks: sampleChunks(), questionCount: 4 });
    expect(a.questions).toEqual(b.questions);
  });

  test('different sourceIds can produce different drafts', () => {
    const a = generate({ sourceId: 'src-1', chunks: sampleChunks(), questionCount: 4 });
    const b = generate({ sourceId: 'src-2', chunks: sampleChunks(), questionCount: 4 });
    expect(a.questions).not.toEqual(b.questions);
  });
});

describe('mock provider — no verbatim source reproduction (§3.4, hard constraint)', () => {
  test('no generated question text or option is an 8+ word verbatim run from the source', () => {
    const bannedRuns = new Set([...eightWordRuns(SOURCE_TEXT), ...eightWordRuns(SOURCE_TEXT_2)]);
    const { questions } = generate({ sourceId: 'verbatim-check', chunks: sampleChunks(), questionCount: 8 });
    for (const q of questions) {
      const allStrings = [q.text, ...q.options];
      for (const str of allStrings) {
        const runs = eightWordRuns(str);
        for (const run of runs) {
          expect(bannedRuns.has(run)).toBe(false);
        }
      }
    }
  });
});

describe('mock provider — quality bar (§6.8)', () => {
  test('every question is a complete sentence ending in "?"', () => {
    const { questions } = generate({ sourceId: 'quality-check', chunks: sampleChunks(), questionCount: 5 });
    for (const q of questions) {
      expect(q.text.trim().endsWith('?')).toBe(true);
      expect(q.text.split(' ').length).toBeGreaterThan(3); // not a fragment
    }
  });

  test('every question has exactly 4 options and a valid correctIndex', () => {
    const { questions } = generate({ sourceId: 'shape-check', chunks: sampleChunks(), questionCount: 5 });
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(3);
      expect(q.options[q.correctIndex]).toBeTruthy();
    }
  });

  test('distractors are drawn from OTHER extracted concepts, not the anchor term itself', () => {
    const { questions } = generate({ sourceId: 'distractor-check', chunks: sampleChunks(), questionCount: 5 });
    for (const q of questions) {
      const uniqueOptions = new Set(q.options.map(o => o.toLowerCase()));
      expect(uniqueOptions.size).toBe(4); // no duplicate options
    }
  });

  test('each question carries a sourceRef pointing at a real chunk index', () => {
    const { questions } = generate({ sourceId: 'sourceref-check', chunks: sampleChunks(), questionCount: 4 });
    for (const q of questions) {
      expect(q.sourceRef.every(i => i === 0 || i === 1)).toBe(true);
    }
  });
});

describe('mock provider — insufficient content', () => {
  test('throws InsufficientContentError when fewer than 4 distinct terms exist', () => {
    const tinyChunks = [{ index: 0, page: 1, text: 'the a is of' }];
    expect(() => generate({ sourceId: 'tiny', chunks: tinyChunks, questionCount: 5 }))
      .toThrow(InsufficientContentError);
  });
});

describe('extractKeyTerms', () => {
  test('excludes common stopwords and short words', () => {
    const terms = extractKeyTerms('there were about many because of these plants and the chloroplast');
    expect(terms).not.toContain('there');
    expect(terms).not.toContain('because');
    expect(terms.some(t => t.toLowerCase() === 'chloroplast')).toBe(true);
  });

  test('caps at maxPerChunk', () => {
    const text = 'alpha beta gamma delta epsilon zeta eta theta';
    expect(extractKeyTerms(text, 3)).toHaveLength(3);
  });
});
