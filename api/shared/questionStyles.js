// Optional "question focus" for AI generation (v4.7.x). Prompt-only: every style still produces
// the standard 4-option multiple-choice shape — variable formats (true/false, yes/no) are a
// separate, larger feature because the 4-option count is hardcoded in draftSchema.js +
// questions.js (×2). Default is 'mixed'. Plain-language keys — no jargon (house rule).
//
// Mirrors src/data/questionStyles.js (CommonJS backend vs ESM frontend — duplicated by
// convention, same as topicTags/CONFIDENCE_VALUES). Keep both in sync if the set changes.
const QUESTION_STYLES = ['mixed', 'recall', 'conceptual', 'analytical'];

// The instruction fragment injected into the user prompt per style. One place, so the prompt and
// the validated enum can't drift.
const STYLE_PROMPT = {
  mixed: 'Include a mix of recall, conceptual, and analytical questions.',
  recall: 'Focus on factual recall — checking whether the student remembers key facts, terms, and definitions from the source.',
  conceptual: 'Focus on conceptual understanding — the why and how, and the relationships between ideas, not just isolated facts.',
  analytical: 'Focus on analysis and application — applying the ideas to new situations, interpreting, comparing, or reasoning from the source.',
};

function isValidQuestionStyle(v) {
  return typeof v === 'string' && QUESTION_STYLES.includes(v);
}

// Returns '' for undefined/unknown — callers can concatenate unconditionally.
function stylePromptLine(v) {
  return STYLE_PROMPT[v] || '';
}

module.exports = { QUESTION_STYLES, isValidQuestionStyle, stylePromptLine };
