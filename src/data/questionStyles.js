// "Question focus" options for AI generation (v4.7.x). Mirrors api/shared/questionStyles.js
// (ESM frontend vs CommonJS backend — duplicated by convention, same as topicTags). Keep the
// `value`s in sync with the server enum. Prompt-only: every focus still produces 4-option MCQ.
// Labels are plain-language (no jargon). Default is 'mixed'.
const QUESTION_STYLES = [
  { value: 'mixed', label: 'Mixed (default)' },
  { value: 'recall', label: 'Recall & fact-checking' },
  { value: 'conceptual', label: 'Conceptual understanding' },
  { value: 'analytical', label: 'Analysis & application' },
]

export default QUESTION_STYLES
