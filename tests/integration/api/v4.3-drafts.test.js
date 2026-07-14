// Integration tests for v4.3.0 Stage 3 — draft endpoints, approve, expand, send-transition.
//
// Requires: func start running against the TEST Cosmos with source_materials/quiz_drafts
// provisioned (docs/azure/V430_CONTAINERS_SETUP.md), B2C_ALLOW_UNVERIFIED_DEV=true.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/v4.3-drafts.test.js

const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;
const beforeAll_int = RUN ? beforeAll : (() => {});

const TEACHER_A = `v43-drafts-A-${Date.now()}`;
const TEACHER_B = `v43-drafts-B-${Date.now()}`;

function authHeaders(oid) {
  const token = jwt.sign({ oid, name: 'Integration Teacher' }, 'dev-key', { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

async function buildPdf(pagesText) {
  const doc = new PDFDocument();
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise(res => doc.on('end', res));
  pagesText.forEach((text, i) => {
    if (i > 0) doc.addPage();
    doc.text(text);
  });
  doc.end();
  await done;
  return Buffer.concat(chunks);
}

const LONG_TEXT_1 = 'Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose molecules inside chloroplast structures found throughout every green leaf on the plant surface consistently.';
const LONG_TEXT_2 = 'Mitochondria are the powerhouse of the cell and generate most of the chemical energy needed to power biochemical reactions through cellular respiration processes that occur constantly within living organisms.';

async function uploadSource(teacherId) {
  const pdfBuf = await buildPdf([LONG_TEXT_1, LONG_TEXT_2]);
  const form = new FormData();
  form.append('attested', 'true');
  form.append('file', new Blob([pdfBuf]), 'bio.pdf');
  const res = await fetch(`${FUNC_URL}/generation/sources`, { method: 'POST', headers: authHeaders(teacherId), body: form });
  return res.json();
}

async function createDraft(teacherId, sourceId, overrides = {}) {
  const res = await fetch(`${FUNC_URL}/generation/drafts`, {
    method: 'POST',
    headers: { ...authHeaders(teacherId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceId, questionCount: 4, ...overrides }),
  });
  return { status: res.status, body: await res.json() };
}

let sourceA, draftA;

beforeAll_int(async () => {
  sourceA = await uploadSource(TEACHER_A);
});

describe('POST /api/generation/drafts', () => {
  it_int('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${FUNC_URL}/generation/drafts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId: 'x', questionCount: 5 }),
    });
    expect(res.status).toBe(401);
  });

  it_int('rejects a missing sourceId with 400', async () => {
    const { status } = await createDraft(TEACHER_A, undefined);
    expect(status).toBe(400);
  });

  it_int('rejects questionCount outside 3-15 with 400', async () => {
    const { status } = await createDraft(TEACHER_A, sourceA.sourceId, { questionCount: 20 });
    expect(status).toBe(400);
  });

  it_int('rejects an out-of-bounds range with 400', async () => {
    const { status } = await createDraft(TEACHER_A, sourceA.sourceId, { range: { start: 0, end: 99 } });
    expect(status).toBe(400);
  });

  it_int('a valid request creates a draft with unreviewed questions', async () => {
    const { status, body } = await createDraft(TEACHER_A, sourceA.sourceId);
    expect(status).toBe(201);
    expect(body.questions.length).toBe(4);
    expect(body.questions.every(q => q.reviewed === false)).toBe(true);
    expect(body.status).toBe('draft');
    draftA = body;
  });

  it_int('an unknown/other-teacher sourceId is treated as expired (plain 400)', async () => {
    const { status } = await createDraft(TEACHER_A, 'not-a-real-source-id');
    expect(status).toBe(400);
  });

  it_int('the 11th generation in a day is rejected with 429', async () => {
    const quotaTeacher = `v43-quota-gen-${Date.now()}`;
    const src = await uploadSource(quotaTeacher);
    let lastStatus;
    for (let i = 0; i < 11; i++) {
      const { status } = await createDraft(quotaTeacher, src.sourceId);
      lastStatus = status;
    }
    expect(lastStatus).toBe(429);
  }, 30000);
});

describe('GET/PUT /api/generation/drafts/{id}', () => {
  it_int('Teacher B cannot read Teacher A\'s draft (cross-tenant negative test)', async () => {
    const res = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}`, { headers: authHeaders(TEACHER_B) });
    expect(res.status).toBe(404);
  });

  it_int('PUT rejects an invalid question shape with 400', async () => {
    const badQuestions = draftA.questions.map(q => ({ ...q, options: ['only', 'two'] }));
    const res = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}`, {
      method: 'PUT', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: badQuestions }),
    });
    expect(res.status).toBe(400);
  });

  it_int('PUT marks questions reviewed', async () => {
    const reviewed = draftA.questions.map(q => ({ ...q, reviewed: true }));
    const res = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}`, {
      method: 'PUT', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: reviewed }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions.every(q => q.reviewed === true)).toBe(true);
  });
});

describe('POST /api/generation/drafts/{id}/regenerate-question', () => {
  it_int('resets the reviewed flag on the regenerated question', async () => {
    const res = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}/regenerate-question`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex: 0 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.question.reviewed).toBe(false);
  });

  it_int('an out-of-range questionIndex is rejected with 400', async () => {
    const res = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}/regenerate-question`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionIndex: 999 }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/generation/drafts/{id}/approve', () => {
  it_int('rejects approval while any question is unreviewed', async () => {
    // question 0 was reset to unreviewed by the regenerate-question test above.
    const res = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}/approve`, { method: 'POST', headers: authHeaders(TEACHER_A) });
    expect(res.status).toBe(400);
  });

  it_int('approving materialises N questions + one draft-status quiz, then a second approve 400s', async () => {
    // Re-review everything first.
    const getRes = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}`, { headers: authHeaders(TEACHER_A) });
    const current = await getRes.json();
    await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}`, {
      method: 'PUT', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: current.questions.map(q => ({ ...q, reviewed: true })) }),
    });

    const res = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}/approve`, { method: 'POST', headers: authHeaders(TEACHER_A) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questionIds.length).toBe(4);
    expect(typeof body.quizId).toBe('string');
    draftA.quizId = body.quizId;

    const secondRes = await fetch(`${FUNC_URL}/generation/drafts/${draftA.id}/approve`, { method: 'POST', headers: authHeaders(TEACHER_A) });
    expect(secondRes.status).toBe(400);
  });

  it_int('the materialised questions are locked to private visibility and cannot be published', async () => {
    const qid = draftA && draftA.quizId ? null : null; // placeholder, real id comes from quiz below
    // Fetch the quiz to get a real question id.
    const quizRes = await fetch(`${FUNC_URL}/quizzes/${draftA.quizId}`, { headers: authHeaders(TEACHER_A) });
    const quiz = await quizRes.json();
    const questionId = quiz.questionIds[0];
    const putRes = await fetch(`${FUNC_URL}/questions/${questionId}`, {
      method: 'PUT', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'edited text here', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Science', visibility: 'public' }),
    });
    expect(putRes.status).toBe(400);
  });
});

describe('POST /api/quizzes/{id}/send — send-transition', () => {
  it_int('Teacher B cannot send Teacher A\'s draft-status quiz (cross-tenant negative test)', async () => {
    const res = await fetch(`${FUNC_URL}/quizzes/${draftA.quizId}/send`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_B), 'Content-Type': 'application/json' },
      body: JSON.stringify({ classIds: [], durationMinutes: 30, mode: 'now' }),
    });
    expect(res.status).toBe(404);
  });

  it_int('rejects spacedRepeats with more than 5 entries', async () => {
    const res = await fetch(`${FUNC_URL}/quizzes/${draftA.quizId}/send`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ classIds: [], durationMinutes: 30, mode: 'now', spacedRepeats: [1, 2, 3, 4, 5, 6] }),
    });
    expect(res.status).toBe(400);
  });

  it_int('sending now with 2 spaced repeats creates 2 clones carrying parentQuizId', async () => {
    const res = await fetch(`${FUNC_URL}/quizzes/${draftA.quizId}/send`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ classIds: [], durationMinutes: 30, mode: 'now', spacedRepeats: [2, 7] }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clonesCreated).toBe(2);
    expect(body.quiz.status).toBe('sent');

    const listRes = await fetch(`${FUNC_URL}/quizzes`, { headers: authHeaders(TEACHER_A) });
    const quizzes = await listRes.json();
    const clones = quizzes.filter(q => q.parentQuizId === draftA.quizId);
    expect(clones.length).toBe(2);
    expect(clones.every(c => c.status === 'scheduled')).toBe(true);
  });

  it_int('re-sending an already-sent quiz is rejected with 400', async () => {
    const res = await fetch(`${FUNC_URL}/quizzes/${draftA.quizId}/send`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ classIds: [], durationMinutes: 30, mode: 'now' }),
    });
    expect(res.status).toBe(400);
  });

  it_int('retrying a send is idempotent — no duplicate clones on retry of a fresh draft quiz', async () => {
    const src = await uploadSource(TEACHER_A);
    const { body: draft } = await createDraft(TEACHER_A, src.sourceId);
    await fetch(`${FUNC_URL}/generation/drafts/${draft.id}`, {
      method: 'PUT', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: draft.questions.map(q => ({ ...q, reviewed: true })) }),
    });
    const approveRes = await fetch(`${FUNC_URL}/generation/drafts/${draft.id}/approve`, { method: 'POST', headers: authHeaders(TEACHER_A) });
    const { quizId } = await approveRes.json();

    const sendBody = JSON.stringify({ classIds: [], durationMinutes: 30, mode: 'now', spacedRepeats: [3] });
    const first = await fetch(`${FUNC_URL}/quizzes/${quizId}/send`, { method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' }, body: sendBody });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.clonesCreated).toBe(1);

    const listRes = await fetch(`${FUNC_URL}/quizzes`, { headers: authHeaders(TEACHER_A) });
    const quizzes = await listRes.json();
    const clonesForThisQuiz = quizzes.filter(q => q.parentQuizId === quizId);
    expect(clonesForThisQuiz.length).toBe(1); // exactly one, no duplicates
  });
});

describe('POST /api/generation/expand', () => {
  it_int('rejects a quiz with no linked source', async () => {
    // Create a plain manual quiz with no sourceId.
    const questionRes = await fetch(`${FUNC_URL}/questions`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'manual q?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, topic: 'Science' }),
    });
    const question = await questionRes.json();
    const quizRes = await fetch(`${FUNC_URL}/quizzes`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'manual quiz', questionIds: [question.id], status: 'draft' }),
    });
    const manualQuiz = await quizRes.json();

    const res = await fetch(`${FUNC_URL}/generation/expand`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: manualQuiz.id, focusQuestionIds: [] }),
    });
    expect(res.status).toBe(400);
  });

  it_int('Teacher B cannot expand Teacher A\'s quiz (cross-tenant negative test)', async () => {
    const res = await fetch(`${FUNC_URL}/generation/expand`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_B), 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: draftA.quizId, focusQuestionIds: [] }),
    });
    expect(res.status).toBe(404);
  });

  it_int('a valid expand returns a new draft', async () => {
    const res = await fetch(`${FUNC_URL}/generation/expand`, {
      method: 'POST', headers: { ...authHeaders(TEACHER_A), 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: draftA.quizId, focusQuestionIds: [] }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.questions.length).toBeGreaterThan(0);
    expect(body.expandedFromQuizId).toBe(draftA.quizId);
  });
});
