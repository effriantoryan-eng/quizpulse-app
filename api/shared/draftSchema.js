// Single validator for AI-generated quiz drafts (v4.3.0) — used for BOTH raw adapter output
// (invalid → 502, never stored) and teacher edits via PUT /api/generation/drafts/{id} (invalid →
// 400). One function, two call sites map its result to different HTTP statuses — the validation
// rules themselves must never drift between "what the LLM produced" and "what a human edited it
// into", per the sprint's single-source-of-truth convention.

const { isValidTopicTag } = require('./topicTags');

const MIN_QUESTIONS = 3;
const MAX_QUESTIONS = 15;
const MAX_TEXT_CHARS = 500;
const MAX_OPTION_CHARS = 200;
const OPTION_COUNT = 4;

// Returns { valid: boolean, errors: [{ index: number|null, message: string }] }.
// chunkCount is the source's total chunk count — sourceRef indexes must stay within it (the
// hallucination guard: an LLM inventing a page/chunk reference outside the real document fails
// validation here rather than silently shipping a wrong citation).
function validateDraftQuestions(questions, { chunkCount } = {}) {
  const errors = [];

  if (!Array.isArray(questions)) {
    return { valid: false, errors: [{ index: null, message: 'questions must be an array' }] };
  }
  if (questions.length < MIN_QUESTIONS || questions.length > MAX_QUESTIONS) {
    errors.push({ index: null, message: `Must have between ${MIN_QUESTIONS} and ${MAX_QUESTIONS} questions` });
  }

  questions.forEach((q, index) => {
    if (!q || typeof q !== 'object') {
      errors.push({ index, message: 'question must be an object' });
      return;
    }
    if (typeof q.text !== 'string' || !q.text.trim()) {
      errors.push({ index, message: 'text is required' });
    } else if (q.text.length > MAX_TEXT_CHARS) {
      errors.push({ index, message: `text must be ${MAX_TEXT_CHARS} characters or fewer` });
    }

    if (!Array.isArray(q.options) || q.options.length !== OPTION_COUNT) {
      errors.push({ index, message: `must have exactly ${OPTION_COUNT} options` });
    } else {
      q.options.forEach((opt, oi) => {
        if (typeof opt !== 'string' || !opt.trim()) {
          errors.push({ index, message: `option ${oi} is required` });
        } else if (opt.length > MAX_OPTION_CHARS) {
          errors.push({ index, message: `option ${oi} must be ${MAX_OPTION_CHARS} characters or fewer` });
        }
      });
    }

    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > OPTION_COUNT - 1) {
      errors.push({ index, message: 'correctIndex must be an integer 0-3' });
    }

    if (q.sourceRef !== undefined && q.sourceRef !== null) {
      const validRefArray = Array.isArray(q.sourceRef) &&
        q.sourceRef.every(ci => Number.isInteger(ci) && ci >= 0 && (chunkCount === undefined || ci < chunkCount));
      if (!validRefArray) {
        errors.push({ index, message: 'sourceRef must be an array of valid chunk indexes' });
      }
    }

    if (q.topicTag !== undefined && q.topicTag !== null && !isValidTopicTag(q.topicTag)) {
      errors.push({ index, message: 'topicTag is not a recognised preset' });
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = { validateDraftQuestions, MIN_QUESTIONS, MAX_QUESTIONS, MAX_TEXT_CHARS, MAX_OPTION_CHARS, OPTION_COUNT };
