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

  test('system prompt forbids referring to the source ("based on the slides" etc.)', () => {
    const sys = buildSystemPrompt();
    expect(sys).toMatch(/stand alone/i);
    expect(sys).toMatch(/never refer to it/i);
  });

  test('system prompt enforces MCQ quality rules (one correct, no answer tells, no all-of-above)', () => {
    const sys = buildSystemPrompt();
    expect(sys).toMatch(/exactly one option is correct/i);
    expect(sys).toMatch(/misconception/i);          // distractors reflect real mistakes (drives analytics)
    expect(sys).toMatch(/not shuffled/i);            // options shown in given order → no length/position tell
    expect(sys).toMatch(/all of the above/i);        // banned
  });

  test('system prompt enforces grounding, distinctness, minor-safety, and plain text', () => {
    const sys = buildSystemPrompt();
    expect(sys).toMatch(/do not invent details/i);   // anti-hallucination / source-grounded
    expect(sys).toMatch(/distinct/i);                // no duplicate questions
    expect(sys).toMatch(/minors/i);                  // content safety
    expect(sys).toMatch(/plain text only/i);         // no markdown / no A. B. labels
  });

  test('user prompt pins the exact requested count', () => {
    expect(buildUserPrompt({ chunks: [{ index: 0, text: 'x' }], questionCount: 1 }))
      .toMatch(/exactly 1 questions?/i);
    expect(buildUserPrompt({ chunks: [{ index: 0, text: 'x' }], questionCount: 5 }))
      .toMatch(/exactly 5 questions?/i);
  });
});

describe('llmPrompts — question style', () => {
  const base = { chunks: [{ index: 0, text: 'x' }], questionCount: 5 };

  test('recall style injects a fact-recall instruction', () => {
    expect(buildUserPrompt({ ...base, questionStyle: 'recall' })).toMatch(/factual recall/i);
  });

  test('analytical style injects an analysis/application instruction', () => {
    expect(buildUserPrompt({ ...base, questionStyle: 'analytical' })).toMatch(/analysis and application/i);
  });

  test('year level from topicTag is injected only when the topic names a year', () => {
    const base = { chunks: [{ index: 0, text: 'x' }], questionCount: 5 };
    // Named year → difficulty line present with the right number.
    expect(buildUserPrompt({ ...base, topicTag: 'Year 7 Science' })).toMatch(/write for year 7 students/i);
    expect(buildUserPrompt({ ...base, topicTag: 'Year 11 Maths' })).toMatch(/write for year 11 students/i);
    // No topic, or a non-"Year N" topic → no year line at all.
    expect(buildUserPrompt(base)).not.toMatch(/write for year/i);
    expect(buildUserPrompt({ ...base, topicTag: 'General Science' })).not.toMatch(/write for year/i);
  });

  test('no style (or unknown/mixed) adds no stray style line beyond the base prompt', () => {
    // undefined → no extra line; unknown → stylePromptLine returns '' → no extra line.
    expect(buildUserPrompt(base)).not.toMatch(/factual recall|analysis and application|conceptual understanding/i);
    expect(buildUserPrompt({ ...base, questionStyle: 'bogus' })).not.toMatch(/factual recall|analysis and application/i);
  });
});
