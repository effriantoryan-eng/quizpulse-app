// v4.6.0 — a generic, curriculum-neutral starter pack so a brand-new teacher can see the
// Send -> Analytics loop without writing a single question first. Content-reviewed to the same
// verbatim-accuracy bar as api/shared/apstContent.js before v4.6.0-rc1: human-written,
// minors-safe, study-skills/general knowledge only (no subject curriculum claims).
//
// Seeded into the teacher's OWN questions container (never a shared pool) so ownership/limits
// work exactly like any other question. `origin: 'starter'` is the provenance marker — mirrors
// the `generatedBy: 'ai'` convention already used for AI-materialised questions.
const { deterministicId } = require('./materializeAi');

// ponytail: correct-answer index is deliberately varied (2,0,3,1,2) across the pack — an earlier
// draft had 4 of 5 correct answers sitting at index 1, which a student pattern-matches in one send.
const STARTER_PACK = [
  {
    text: 'Which of these is the best way to remember something for a test next week?',
    options: [
      'Review it once the night before',
      'Read it silently one time',
      'Review it a little bit on several different days',
      'Highlight it in a different colour',
    ],
    correctIndex: 2,
  },
  {
    text: 'You have 3 tasks due this week. What is the most helpful first step?',
    options: [
      'List all 3 and note which is due soonest',
      'Start with whichever one is easiest',
      'Do them in the order they were given',
      'Wait until the day before each is due',
    ],
    correctIndex: 0,
  },
  {
    text: "If you don't understand something a teacher explained, what's usually the best move?",
    options: [
      'Say nothing and hope it makes sense later',
      'Copy a classmate\'s answer',
      'Skip that topic entirely',
      'Ask a question about the specific part that is confusing',
    ],
    correctIndex: 3,
  },
  {
    text: 'Which habit helps most with staying focused while studying?',
    options: [
      'Studying with the TV on in the background',
      'Taking short breaks between focused study blocks',
      'Studying for as long as possible without stopping',
      'Switching subjects every two minutes',
    ],
    correctIndex: 1,
  },
  {
    text: 'What is a good reason to double-check your work before handing it in?',
    options: [
      'To make it look neater',
      'Because it takes up more time',
      'To catch small mistakes you can still fix',
      'It is not usually worth doing',
    ],
    correctIndex: 2,
  },
];

function starterQuestionId(teacherId, index) {
  return deterministicId('starter-question', teacherId, index);
}

// Idempotent: 409-tolerant sequential creates with deterministic ids (materializeAi pattern), so
// re-calling this after a partial failure (or a teacher hitting both the finale AND the empty-
// state CTA) never duplicates questions. Returns the 5 question docs (existing or newly created).
async function seedStarterQuestions(teacherId, questionsContainer) {
  const docs = [];
  for (let i = 0; i < STARTER_PACK.length; i++) {
    const q = STARTER_PACK[i];
    const doc = {
      id: starterQuestionId(teacherId, i),
      teacherId,
      authorId: teacherId,
      visibility: 'private',
      text: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      topic: null,
      origin: 'starter',
      upvoteCount: 0,
      usageCount: 0,
      createdAt: new Date().toISOString(),
    };
    try {
      const { resource } = await questionsContainer.items.create(doc);
      docs.push(resource);
    } catch (err) {
      if (err.code === 409) {
        const { resource } = await questionsContainer.item(doc.id, teacherId).read();
        docs.push(resource);
        continue;
      }
      throw err;
    }
  }
  return docs;
}

module.exports = { STARTER_PACK, starterQuestionId, seedStarterQuestions };
