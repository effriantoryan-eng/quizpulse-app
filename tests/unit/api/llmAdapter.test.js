// Unit tests for api/shared/llmAdapter.js (v4.3.0).

const { generateDraft, selectChunks, INPUT_CHAR_CAP, MissingProviderKeyError } = require('../../../api/shared/llmAdapter');

function makeChunks(n, charsEach = 100) {
  return Array.from({ length: n }, (_, i) => ({ index: i, page: i + 1, text: 'W'.repeat(charsEach) }));
}

describe('selectChunks', () => {
  test('returns everything when under the char cap', () => {
    const chunks = makeChunks(5, 100);
    expect(selectChunks(chunks, null)).toEqual(chunks);
  });

  test('applies an explicit range first', () => {
    const chunks = makeChunks(10, 100);
    const selected = selectChunks(chunks, { start: 2, end: 4 });
    expect(selected.map(c => c.index)).toEqual([2, 3, 4]);
  });

  test('samples evenly when over the char cap, staying within it', () => {
    const chunks = makeChunks(1000, 100); // 100,000 chars total, over the 60k cap
    const selected = selectChunks(chunks, null);
    const totalChars = selected.reduce((sum, c) => sum + c.text.length, 0);
    expect(totalChars).toBeLessThanOrEqual(INPUT_CHAR_CAP);
    // Sampling should spread across the range, not just take a contiguous prefix.
    const indexes = selected.map(c => c.index);
    expect(Math.max(...indexes) - Math.min(...indexes)).toBeGreaterThan(100);
  });
});

describe('generateDraft — provider resolution', () => {
  const originalEnv = process.env.LLM_PROVIDER;
  afterEach(() => { process.env.LLM_PROVIDER = originalEnv; });

  test('defaults to the mock provider when LLM_PROVIDER is unset', async () => {
    delete process.env.LLM_PROVIDER;
    const chunks = [
      { index: 0, page: 1, text: 'Photosynthesis converts light energy into chemical energy inside chloroplasts.' },
      { index: 1, page: 2, text: 'Mitochondria generate cellular energy through respiration processes constantly.' },
    ];
    const result = await generateDraft({ sourceId: 'adapter-test', chunks, questionCount: 3 });
    expect(result.provider).toBe('mock');
    expect(result.questions).toHaveLength(3);
    expect(result.chunkChars).toBeGreaterThan(0);
    expect(Array.isArray(result.pagesUsed)).toBe(true);
  });

  test('a real provider without its required env vars throws MissingProviderKeyError (mapped to 503 by the caller)', async () => {
    process.env.LLM_PROVIDER = 'azureOpenai';
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_ENDPOINT;
    delete process.env.LLM_MODEL;
    const chunks = [{ index: 0, page: 1, text: 'Some source text here for the adapter to select.' }];
    await expect(generateDraft({ sourceId: 'missing-key-test', chunks, questionCount: 3 }))
      .rejects.toBeInstanceOf(MissingProviderKeyError);
  });

  test('logs a structured success line via context.log', async () => {
    delete process.env.LLM_PROVIDER;
    const logs = [];
    const context = { log: (msg) => logs.push(msg), error: () => {} };
    const chunks = [
      { index: 0, page: 1, text: 'Photosynthesis converts light energy into chemical energy inside chloroplasts.' },
      { index: 1, page: 2, text: 'Mitochondria generate cellular energy through respiration processes constantly.' },
    ];
    await generateDraft({ context, sourceId: 'log-test', chunks, questionCount: 3 });
    expect(logs).toHaveLength(1);
    const parsed = JSON.parse(logs[0]);
    expect(parsed).toMatchObject({ sourceId: 'log-test', provider: 'mock', questionCount: 3, outcome: 'success' });
  });

  test('logs a structured error line via context.error on missing-key failure', async () => {
    process.env.LLM_PROVIDER = 'anthropic';
    delete process.env.LLM_API_KEY;
    const errors = [];
    const context = { log: () => {}, error: (msg) => errors.push(msg) };
    const chunks = [{ index: 0, page: 1, text: 'text' }];
    await expect(generateDraft({ context, sourceId: 'error-log-test', chunks, questionCount: 3 })).rejects.toThrow();
    expect(errors).toHaveLength(1);
    expect(JSON.parse(errors[0])).toMatchObject({ outcome: 'error', rejectReason: 'missing-provider-key' });
  });
});
