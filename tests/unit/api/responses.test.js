// Unit tests for responses.js logic — Sprint 4: approval gate (403), duplicate submission (409),
// closed quiz (410). Mirrors the handler logic in api/responses.js for isolated testing.

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

  return async function handler({ quizId, studentId, answers }) {
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

    const { resource } = await responsesContainer.items.create({
      id: 'r1', quizId, studentId, answers, completedAt: new Date().toISOString(),
    });
    return { status: 201, resource };
  };
}

describe('responses — approval gate', () => {
  test('returns 403 when student has no approved join request for the quiz classes', async () => {
    const quiz = { id: 'q1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, approvedJoinRequests: [] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [{ questionId: 'a', selectedIndex: 0 }] });
    expect(result.status).toBe(403);
  });

  test('returns 201 when student has an approved join request', async () => {
    const quiz = { id: 'q1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [{ questionId: 'a', selectedIndex: 0 }] });
    expect(result.status).toBe(201);
  });
});

describe('responses — duplicate submission', () => {
  test('returns 409 when a response already exists for this student + quiz', async () => {
    const quiz = { id: 'q1', classIds: ['c1'] };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }], existingResponses: [{ id: 'r0' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [{ questionId: 'a', selectedIndex: 0 }] });
    expect(result.status).toBe(409);
  });
});

describe('responses — closed quiz', () => {
  test('returns 410 when quiz.closedAt is in the past', async () => {
    const quiz = { id: 'q1', classIds: ['c1'], closedAt: new Date(Date.now() - 60000).toISOString() };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [{ questionId: 'a', selectedIndex: 0 }] });
    expect(result.status).toBe(410);
  });

  test('returns 201 when quiz.closedAt is in the future', async () => {
    const quiz = { id: 'q1', classIds: ['c1'], closedAt: new Date(Date.now() + 60000).toISOString() };
    const handler = makeHandler({ quiz, approvedJoinRequests: [{ id: 'jr1' }] });
    const result = await handler({ quizId: 'q1', studentId: 'device-1', answers: [{ questionId: 'a', selectedIndex: 0 }] });
    expect(result.status).toBe(201);
  });

  test('returns 404 when the quiz does not exist', async () => {
    const handler = makeHandler({ quiz: null });
    const result = await handler({ quizId: 'missing', studentId: 'device-1', answers: [{ questionId: 'a', selectedIndex: 0 }] });
    expect(result.status).toBe(404);
  });
});
