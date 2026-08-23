// Guards the regenerate cost/latency bug fixed 2026-08-23: the system prompt used to hardcode
// "Produce between 3 and 15 questions", which contradicted the per-call "Generate exactly N" in the
// user prompt. For a regenerate call (N=1 < MIN=3), the model honored the system floor and returned
// 3 questions — 2 discarded, all billed. Root cause was a prompt contradiction, invisible against
// the mock provider (which loops exactly N by construction). See docs/azure/LLM_PROVIDER_SETUP.md.
const { buildSystemPrompt, buildUserPrompt } = require('../../../api/shared/llmPrompts');

describe('llmPrompts — question count authority', () => {
  test('system prompt does NOT hardcode a fixed question-count range (would fight per-call count)', () => {
    const sys = buildSystemPrompt();
    // No "between N and M questions" style floor/ceiling — the count is set per call, not fixed.
    expect(sys).not.toMatch(/between\s+\d+\s+and\s+\d+\s+questions/i);
    // It must defer to the per-call instruction and demand exactness.
    expect(sys).toMatch(/exactly the number of questions requested/i);
  });

  test('user prompt pins the exact requested count', () => {
    expect(buildUserPrompt({ chunks: [{ index: 0, text: 'x' }], questionCount: 1 }))
      .toMatch(/exactly 1 questions?/i);
    expect(buildUserPrompt({ chunks: [{ index: 0, text: 'x' }], questionCount: 5 }))
      .toMatch(/exactly 5 questions?/i);
  });
});
