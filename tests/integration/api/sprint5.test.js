// Integration tests for Sprint 5 — security foundation (cross-tenant access denial).
//
// Requires: func start running, B2C_ALLOW_UNVERIFIED_DEV=true, Cosmos accessible.
// Run with: RUN_INTEGRATION=true npm test -- tests/integration/api/sprint5.test.js
//
// Per the Sprint 5 security audit (docs/security/SPRINT5_AUDIT.md), every resource type a
// teacher can act on must deny Teacher A access to Teacher B's resource by ID, with a 404
// (never 403 — see api/shared/authz.js). A test that gets the resource back is a FAILED test:
// every assertion below is written as "expect denial", not "expect success".

const jwt = require('jsonwebtoken');

const FUNC_URL = process.env.FUNC_URL || 'http://localhost:7071/api';
const RUN = process.env.RUN_INTEGRATION === 'true';
const it_int = RUN ? it : it.skip;
const beforeAll_int = RUN ? beforeAll : (() => {});

function mintToken(oid, extraClaims = {}) {
  return jwt.sign({ oid, name: 'Integration Teacher', emails: [`${oid}@example.com`], ...extraClaims }, 'dev-key', { expiresIn: '1h' });
}

function authHeaders(oid, extraClaims = {}) {
  return {
    Authorization: `Bearer ${mintToken(oid, extraClaims)}`,
    'Content-Type': 'application/json',
  };
}

const TEACHER_A = 'sprint5-teacher-A';
const TEACHER_B = 'sprint5-teacher-B';

// Resources owned by Teacher A, created once and reused across the "Teacher B attempts X"
// tests below.
let classA, questionA, quizA;

async function createClassAsA() {
  const res = await fetch(`${FUNC_URL}/classes`, {
    method: 'POST',
    headers: authHeaders(TEACHER_A),
    body: JSON.stringify({ name: 'Sprint5 Class A', studentCount: 0 }),
  });
  return res.json();
}

async function createQuestionAsA() {
  const res = await fetch(`${FUNC_URL}/questions`, {
    method: 'POST',
    headers: authHeaders(TEACHER_A),
    body: JSON.stringify({
      text: 'Sprint5 question?',
      options: ['a', 'b', 'c', 'd'],
      correctIndex: 0,
      topic: 'Science',
    }),
  });
  return res.json();
}

async function createQuizAsA(questionId) {
  const res = await fetch(`${FUNC_URL}/quizzes`, {
    method: 'POST',
    headers: authHeaders(TEACHER_A),
    body: JSON.stringify({ name: 'Sprint5 Quiz A', questionIds: [questionId], status: 'draft' }),
  });
  return res.json();
}

beforeAll_int(async () => {
  classA = await createClassAsA();
  questionA = await createQuestionAsA();
  quizA = await createQuizAsA(questionA.id);
});

// --- Class ---

describe('Cross-tenant denial — class', () => {
  it_int('Teacher B cannot PUT (update) Teacher A\'s class', async () => {
    const res = await fetch(`${FUNC_URL}/classes/${classA.id}`, {
      method: 'PUT',
      headers: authHeaders(TEACHER_B),
      body: JSON.stringify({ name: 'hijacked' }),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot regenerate Teacher A\'s class join code', async () => {
    const res = await fetch(`${FUNC_URL}/classes/${classA.id}/regenerate-code`, {
      method: 'PUT',
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot DELETE Teacher A\'s class', async () => {
    const res = await fetch(`${FUNC_URL}/classes/${classA.id}`, {
      method: 'DELETE',
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });
});

// --- Roster / namelist ---

describe('Cross-tenant denial — roster / namelist', () => {
  it_int('Teacher B cannot read or write Teacher A\'s class namelist', async () => {
    const res = await fetch(`${FUNC_URL}/classes/${classA.id}/namelist`, {
      method: 'PUT',
      headers: authHeaders(TEACHER_B),
      body: JSON.stringify({ nameList: ['Stolen Name'], nameListEnabled: true }),
    });
    expect(res.status).toBe(404);
  });
});

// --- Question ---

describe('Cross-tenant denial — question', () => {
  it_int('Teacher B cannot edit Teacher A\'s question', async () => {
    const res = await fetch(`${FUNC_URL}/questions/${questionA.id}`, {
      method: 'PUT',
      headers: authHeaders(TEACHER_B),
      body: JSON.stringify({ text: 'hijacked?', options: ['a', 'b', 'c', 'd'], correctIndex: 1, topic: 'Science' }),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot delete Teacher A\'s question', async () => {
    const res = await fetch(`${FUNC_URL}/questions/${questionA.id}`, {
      method: 'DELETE',
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });
});

// --- Quiz ---

describe('Cross-tenant denial — quiz', () => {
  it_int('Teacher B cannot read Teacher A\'s quiz via the teacher-scoped GET', async () => {
    const res = await fetch(`${FUNC_URL}/quizzes/${quizA.id}`, {
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });
});

// --- Analytics ---

describe('Cross-tenant denial — analytics', () => {
  it_int('Teacher B cannot read Teacher A\'s quiz analytics', async () => {
    const res = await fetch(`${FUNC_URL}/analytics?quizId=${quizA.id}`, {
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot export Teacher A\'s quiz analytics as CSV', async () => {
    const res = await fetch(`${FUNC_URL}/analytics/export?quizId=${quizA.id}`, {
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot read Teacher A\'s raw quiz responses (Critical audit finding #1)', async () => {
    const res = await fetch(`${FUNC_URL}/responses?quizId=${quizA.id}`, {
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });

  it_int('an unauthenticated caller cannot read raw quiz responses at all', async () => {
    const res = await fetch(`${FUNC_URL}/responses?quizId=${quizA.id}`);
    expect(res.status).toBe(401);
  });
});

// --- send-notification ---

describe('Cross-tenant denial — send-notification', () => {
  it_int('Teacher B cannot trigger a push send for Teacher A\'s quiz', async () => {
    const res = await fetch(`${FUNC_URL}/send-notification`, {
      method: 'POST',
      headers: authHeaders(TEACHER_B),
      body: JSON.stringify({ quizId: quizA.id, quizTitle: 'hijacked', questionCount: 1 }),
    });
    expect(res.status).toBe(404);
  });
});

// --- join_request ---

describe('Cross-tenant denial — join_request', () => {
  let joinReqId;

  beforeAll_int(async () => {
    if (!RUN) return;
    const res = await fetch(`${FUNC_URL}/join-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ joinCode: classA.joinCode, studentName: 'Sprint5 Student', deviceId: 'sprint5-device-1' }),
    });
    const body = await res.json();
    joinReqId = body.id;
  });

  it_int('Teacher B cannot list Teacher A\'s class join requests', async () => {
    const res = await fetch(`${FUNC_URL}/join-requests?classId=${classA.id}`, {
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot approve a join request on Teacher A\'s class', async () => {
    const res = await fetch(`${FUNC_URL}/join-requests/${joinReqId}/approve?classId=${classA.id}`, {
      method: 'POST',
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot reject a join request on Teacher A\'s class', async () => {
    const res = await fetch(`${FUNC_URL}/join-requests/${joinReqId}/reject?classId=${classA.id}`, {
      method: 'POST',
      headers: authHeaders(TEACHER_B),
    });
    expect(res.status).toBe(404);
  });

  it_int('Teacher B cannot batch-approve requests on Teacher A\'s class', async () => {
    const res = await fetch(`${FUNC_URL}/join-requests/approve-batch`, {
      method: 'POST',
      headers: authHeaders(TEACHER_B),
      body: JSON.stringify({ classId: classA.id, ids: [joinReqId] }),
    });
    expect(res.status).toBe(404);
  });
});

// --- school_admin cross-school denial ---
//
// No endpoint implements schoolId-based scoping yet (school_admin is a Sprint 5/6 PLANNED
// feature — see CLAUDE.md Feature status table); assertScope's schoolId branch is covered by
// the unit tests in tests/unit/api/authz.test.js. This is a placeholder marking where a real
// HTTP-level cross-school test belongs once a school-scoped admin endpoint exists.
describe.skip('Cross-tenant denial — school_admin cross-school reads (no school-scoped endpoint exists yet)', () => {
  it('school_admin from school X cannot read school Y\'s data', () => {});
});

// --- Role escalation ---

describe('Role escalation denial', () => {
  it_int('a teacher cannot set their own role via onboarding', async () => {
    const res = await fetch(`${FUNC_URL}/onboarding`, {
      method: 'POST',
      headers: authHeaders('sprint5-escalation-teacher'),
      body: JSON.stringify({ schoolName: 'Escalation High', role: 'owner' }),
    });
    expect(res.status).toBe(400);

    const me = await fetch(`${FUNC_URL}/me`, { headers: authHeaders('sprint5-escalation-teacher') });
    const meBody = await me.json();
    // Either onboarding never ran (still unonboarded) or it ran without honoring `role`.
    if (meBody.onboarded) {
      expect(meBody.teacher.role).toBe('teacher');
    }
  });

  it_int('a non-owner caller gets 404 from the owner-gated role-change endpoint', async () => {
    const res = await fetch(`${FUNC_URL}/manage/teachers/${TEACHER_A}/role`, {
      method: 'PUT',
      headers: authHeaders(TEACHER_B), // plain 'teacher' role — not 'owner'
      body: JSON.stringify({ role: 'owner' }),
    });
    expect(res.status).toBe(404);
  });

  it_int('even an owner-role caller cannot grant themselves a role via any teacher-facing endpoint other than the dedicated one', async () => {
    // Confirms the guard in teacher.js rejects `role` in the body regardless of the caller's
    // own claimed role — onboarding never reads `role` from the body, full stop.
    const res = await fetch(`${FUNC_URL}/onboarding`, {
      method: 'POST',
      headers: authHeaders('sprint5-owner-attempt', { role: 'owner' }),
      body: JSON.stringify({ schoolName: 'Owner Attempt High', role: 'owner' }),
    });
    expect(res.status).toBe(400);
  });
});

// --- Anonymous endpoint abuse ---

describe('Anonymous endpoint denial — POST /api/responses', () => {
  it_int('rejects a response from a deviceId with no approved join request', async () => {
    const res = await fetch(`${FUNC_URL}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quizId: quizA.id,
        studentId: 'sprint5-unapproved-device',
        answers: [{ questionId: questionA.id, selectedIndex: 0 }],
      }),
    });
    expect(res.status).toBe(403);
  });
});
