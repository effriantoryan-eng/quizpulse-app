const { validateDraftQuestions } = require('../../../api/shared/draftSchema');

function goodQuestion(overrides = {}) {
  return {
    text: 'Which of the following is correct?',
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    sourceRef: [0],
    ...overrides,
  };
}

describe('validateDraftQuestions', () => {
  test('accepts a valid 3-question set', () => {
    const result = validateDraftQuestions([goodQuestion(), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('rejects fewer than 3 questions', () => {
    const result = validateDraftQuestions([goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(false);
  });

  test('rejects more than 15 questions', () => {
    const questions = Array.from({ length: 16 }, () => goodQuestion());
    expect(validateDraftQuestions(questions, { chunkCount: 5 }).valid).toBe(false);
  });

  test('rejects a question without exactly 4 options', () => {
    const result = validateDraftQuestions([goodQuestion({ options: ['A', 'B', 'C'] }), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(false);
  });

  test('rejects text over 500 chars', () => {
    const result = validateDraftQuestions([goodQuestion({ text: 'x'.repeat(501) }), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(false);
  });

  test('rejects an option over 200 chars', () => {
    const result = validateDraftQuestions([goodQuestion({ options: ['x'.repeat(201), 'B', 'C', 'D'] }), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(false);
  });

  test('rejects correctIndex outside 0-3', () => {
    const result = validateDraftQuestions([goodQuestion({ correctIndex: 4 }), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(false);
  });

  test('rejects a sourceRef chunk index >= chunkCount (hallucination guard)', () => {
    const result = validateDraftQuestions([goodQuestion({ sourceRef: [10] }), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(false);
  });

  test('sourceRef is optional', () => {
    const q = goodQuestion();
    delete q.sourceRef;
    const result = validateDraftQuestions([q, goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(true);
  });

  test('rejects an invalid topicTag', () => {
    const result = validateDraftQuestions([goodQuestion({ topicTag: 'Not A Real Topic' }), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(false);
  });

  test('accepts a valid preset topicTag', () => {
    const result = validateDraftQuestions([goodQuestion({ topicTag: 'Year 7 Science' }), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(true);
  });

  test('topicTag is optional', () => {
    const result = validateDraftQuestions([goodQuestion(), goodQuestion(), goodQuestion()], { chunkCount: 5 });
    expect(result.valid).toBe(true);
  });
});
