// Unit tests for responses.js logic — Sprint 4: approval gate (403), duplicate submission (409),
// closed quiz (410). Confidence Layer (v3.2): confidence enum validation, responseTimeMs bounds.
// Mirrors the handler logic in api/responses.js for isolated testing.

const CONFIDENCE_VALUES = new Set(['sure', 'pretty_sure', 'guessing']);
const RESPONSE_TIME_MAX_MS = 30 * 60 * 1000;

function validateAnswers(answers) {
  if (!Array.isArray(answers) || answers.length === 0) return { error: 'answers must be a non-empty array' };
  if (answers.length > 50) return { error: 'answers must contain 50 items or fewer' };
  for (const answer of answers) {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return { error: 'each answer must be an object' };
    if (typeof answer.questionId !== 'string' || !answer.questionId.trim()) return { error: 'each answer must have a questionId string' };
    if (typeof answer.selectedIndex !== 'number' || !Number.isInteger(answer.selectedIndex) || answer.selectedIndex < 0 || answer.selectedIndex > 3) {
      return { error: 'each answer.selectedIndex must be an integer between 0 and 3' };
    }
    if (!CONFIDENCE_VALUES.has(answer.confidence)) {
      return { error: 'each answer.confidence must be one of: sure, pretty_sure, guessing' };
    }
    if (answer.responseTimeMs !== undefined) {
      if (typeof answer.responseTimeMs !== 'number' || !Number.isInteger(answer.responseTimeMs) || answer.responseTimeMs < 0 || answer.responseTimeMs > RESPONSE_TIME_MAX_MS) {
        return { error: 'each answer.responseTimeMs must be a non-negative integer not exceeding 30 minutes' };
      }
    }
  }
  return null;
}

function makeHandler({ quiz = null, approvedJoinRequests = [], existingResponses = [] } = {}) {
  const quizzesContainer = {
    items: { query: () => ({ fetchAll: async () => ({ resources: quiz ? [quiz] : [] }) }) },
  };
  const joinRequestsContainer = {
    items: { query: () => ({ fetchAll: async () => ({ resources: approvedJoinRequests }) }) },
  };
  const responsesContainer = {
    items: {
      query: () => ({ fetchAll: async () => ({ resources: existingResponses }) }),
      create: async (doc) => ({ resource: doc }),
    },
  };

  return async function handler({ quizId, studentId, answers, quizDurationMs }) {
    const answerError = validateAnswers(answers);
    if (answerError) return { status: 400, error: answerError.error };

    if (quizDurationMs !== undefined) {
      if (typeof quizDurationMs !== 'number' || !Number.isInteger(quizDurationMs) || quizDurationMs < 0 || quizDurationMs > RESPONSE_TIME_MAX_MS) {
        return { status: 400, error: 'quizDurationMs must be a non-negative integer not exceeding 30 minutes' };
      }
    }

    const { resources: quizMatches } = await quizzesContainer.items.query().fetchAll();
    if (quizMatches.length === 0) return { status: 404 };
    const matchedQuiz = quizMatches[0];

    if (matchedQuiz.closedAt && new Date(matchedQuiz.closedAt).getTime() < Date.now()) {
      return { status: 410 };
    }

    const classIds = matchedQuiz.classIds || [];
    let hasApproval = false;
    if (classIds.length > 0) {
      const { resources: approved } = await joinRequestsContainer.items.query().fetchAll();
      hasApproval = approved.length > 0;
    }
    if (!hasApproval) return { status: 403 };

    const { resources: existing } = await responsesContainer.items.query().fetchAll();
    if (existing.length > 0) return { status: 409 };

    const stored = answers.map(a => {
      const entry = { questionId: a.questionId.trim(), selectedIndex: a.selectedIndex, confidence: a.confidence };
      if (a.responseTimeMs !== undefined) entry.responseTimeMs = a.responseTimeMs;
      return entry;
    });
    const { resource } = await responsesContainer.items.create({
      id: 'r1', quizId, studentId, answers: stored,
      ...(quizDurationMs !== undefined && { quizDurationMs }),
      completedAt: new Date().toISOString(),
    });
    return { status: 201, resource };
  };
}

const validAnswer = (overrides = {}) => ({
  questionId: 'q1', selectedIndex: 0, confidence: 'sure', ...overrides,
});

describe('responses — confidence validation', () => {
  const quiz = { id: 'quiz1', classIds: ['c1'] };
  const approved = [{ id: 'jr1' }];

  test('accepts valid confidence values: sure, pretty_sure, guessing', async () => {
    for (const confidence of ['sure', 'pretty_sure', 'guessing']) {
      const handler = makeHandler({ quiz, approvedJoinRequests: approved });
      const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer({ confidence })] });
      expect(result.status).toBe(201);
    }
  });

  test('rejects missing confidence with 400', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [{ questionId: 'q1', selectedIndex: 0 }] });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/confidence/);
  });

  test('rejects an unknown confidence value with 400', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer({ confidence: 'very_sure' })] });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/confidence/);
  });

  test('stores confidence on each answer in the persisted document', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer({ confidence: 'guessing' })] });
    expect(result.status).toBe(201);
    expect(result.resource.answers[0].confidence).toBe('guessing');
  });
});

describe('responses — responseTimeMs validation', () => {
  const quiz = { id: 'quiz1', classIds: ['c1'] };
  const approved = [{ id: 'jr1' }];

  test('accepts a valid responseTimeMs', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer({ responseTimeMs: 4500 })] });
    expect(result.status).toBe(201);
    expect(result.resource.answers[0].responseTimeMs).toBe(4500);
  });

  test('accepts omitted responseTimeMs', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer()] });
    expect(result.status).toBe(201);
    expect(result.resource.answers[0].responseTimeMs).toBeUndefined();
  });

  test('rejects negative responseTimeMs with 400', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer({ responseTimeMs: -1 })] });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/responseTimeMs/);
  });

  test('rejects absurdly large responseTimeMs (>30 min) with 400', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer({ responseTimeMs: 31 * 60 * 1000 })] });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/responseTimeMs/);
  });

  test('accepts valid quizDurationMs', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer()], quizDurationMs: 120000 });
    expect(result.status).toBe(201);
    expect(result.resource.quizDurationMs).toBe(120000);
  });

  test('rejects negative quizDurationMs with 400', async () => {
    const handler = makeHandler({ quiz, approvedJoinRequests: approved });
    const result = await handler({ quizId: 'quiz1', studentId: 'dev1', answers: [validAnswer()], quizDurationMs: -500 });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/quizDurationMs/);
  });
});

describe('responses — approval gate', () => {
  test('returns 403 when student has no approved join request for the quiz classes', async () => {
    const quiz = { id: 'q1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, approvedJoinRequests: [] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [validAnswer({ questionId: 'a' })] });
    expect(result.status).toBe(403);
  });

  test('returns 201 when student has an approved join request', async () => {
    const quiz = { id: 'q1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [validAnswer({ questionId: 'a' })] });
    expect(result.status).toBe(201);
  });
});

describe('responses — duplicate submission', () => {
  test('returns 409 when a response already exists for this student + quiz', async () => {
    const quiz = { id: 'q1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }], existingResponses: [{ id: 'r0' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [validAnswer({ questionId: 'a' })] });
    expect(result.status).toBe(409);
  });
});

describe('responses — closed quiz', () => {
  test('returns 410 when quiz.closedAt is in the past', async () => {
    const quiz = { id: 'q1', classIds: ['c1'], closedAt: new Date(Date.now() - 60000).toISOString() };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [validAnswer({ questionId: 'a' })] });
    expect(result.status).toBe(410);
  });

  test('returns 201 when quiz.closedAt is in the future', async () => {
    const quiz = { id: 'q1', classIds: ['c1'], closedAt: new Date(Date.now() + 60000).toISOString() };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [validAnswer({ questionId: 'a' })] });
    expect(result.status).toBe(201);
  });

  test('returns 404 when the quiz does not exist', async () => {
    const handler = makeHandler({ quiz: null });
    const result = await handler({ quizId: 'missing', studentId: 'device-1', answers: [validAnswer({ questionId: 'a' })] });
    expect(result.status).toBe(404);
  });
});
