const { QUESTION_STYLES, isValidQuestionStyle, stylePromptLine } = require('../../../api/shared/questionStyles');

describe('questionStyles', () => {
  test('the four preset styles validate', () => {
    for (const s of ['mixed', 'recall', 'conceptual', 'analytical']) {
      expect(isValidQuestionStyle(s)).toBe(true);
    }
    expect(QUESTION_STYLES).toEqual(['mixed', 'recall', 'conceptual', 'analytical']);
  });

  test('unknown / non-string values are rejected', () => {
    expect(isValidQuestionStyle('bogus')).toBe(false);
    expect(isValidQuestionStyle(undefined)).toBe(false);
    expect(isValidQuestionStyle(null)).toBe(false);
    expect(isValidQuestionStyle(3)).toBe(false);
  });

  test('stylePromptLine returns a fragment for known styles, empty string otherwise', () => {
    expect(stylePromptLine('recall')).toMatch(/factual recall/i);
    expect(stylePromptLine('bogus')).toBe('');
    expect(stylePromptLine(undefined)).toBe('');
  });
});
