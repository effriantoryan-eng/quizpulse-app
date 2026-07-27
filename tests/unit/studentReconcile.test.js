// Unit tests for src/studentClasses.js's reconcileApprovals — the v4.5.x fix that lets a device
// which closed its tab before the teacher approved still find its way into the class on the next
// load. The source is an ESM module (Vite-only); Jest's CJS runner can't require() it directly, so
// this mirrors the logic exactly (same convention as topicPrefilter.test.js / usePageView.test.js).
// Keep in lockstep with studentClasses.js.

const APPROVED_KEY = 'quizpulse_approved_classes';
const PENDING_KEY = 'quizpulse_pending_classes';

// In-memory localStorage stand-in (jest node env has no localStorage).
function makeStore(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    _dump: () => data,
  };
}

function getApprovedClasses(ls) {
  try { const raw = ls.getItem(APPROVED_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function addApprovedClass(ls, classId, className) {
  const existing = getApprovedClasses(ls).filter((c) => c.classId !== classId);
  existing.push({ classId, className });
  ls.setItem(APPROVED_KEY, JSON.stringify(existing));
}
function getPendingClasses(ls) {
  try { const raw = ls.getItem(PENDING_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
function removePendingClass(ls, classId) {
  const remaining = getPendingClasses(ls).filter((c) => c.classId !== classId);
  ls.setItem(PENDING_KEY, JSON.stringify(remaining));
}

async function reconcileApprovals(ls, fetchFn, deviceId, apiBase) {
  const pending = getPendingClasses(ls);
  const newlyApproved = [];
  await Promise.all(pending.map(async ({ classId, className }) => {
    try {
      const res = await fetchFn(
        `${apiBase}/join-request/status?deviceId=${encodeURIComponent(deviceId)}&classId=${encodeURIComponent(classId)}`
      );
      if (res.status === 404) { removePendingClass(ls, classId); return; }
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'approved') {
        addApprovedClass(ls, classId, className);
        removePendingClass(ls, classId);
        newlyApproved.push(classId);
      } else if (data.status === 'rejected') {
        removePendingClass(ls, classId);
      }
    } catch {
      // silent
    }
  }));
  return { approved: getApprovedClasses(ls), newlyApproved };
}

const ok = (status) => ({ ok: true, status: 200, json: async () => ({ status }) });
const notFound = () => ({ ok: false, status: 404, json: async () => ({ error: 'No join request found' }) });
const serverErr = () => ({ ok: false, status: 500, json: async () => ({}) });

describe('reconcileApprovals', () => {
  test('promotes an approved pending class and removes it from pending', async () => {
    const ls = makeStore({ [PENDING_KEY]: JSON.stringify([{ classId: 'c1', className: 'Maths' }]) });
    const fetchFn = jest.fn(async () => ok('approved'));

    const { approved, newlyApproved } = await reconcileApprovals(ls, fetchFn, 'dev', '/api');

    expect(approved).toEqual([{ classId: 'c1', className: 'Maths' }]);
    expect(newlyApproved).toEqual(['c1']);
    expect(getPendingClasses(ls)).toEqual([]);
  });

  test('drops a rejected pending class without approving it', async () => {
    const ls = makeStore({ [PENDING_KEY]: JSON.stringify([{ classId: 'c1', className: 'Maths' }]) });
    const fetchFn = jest.fn(async () => ok('rejected'));

    const { approved, newlyApproved } = await reconcileApprovals(ls, fetchFn, 'dev', '/api');

    expect(approved).toEqual([]);
    expect(newlyApproved).toEqual([]);
    expect(getPendingClasses(ls)).toEqual([]);
  });

  test('leaves a still-pending class in place', async () => {
    const ls = makeStore({ [PENDING_KEY]: JSON.stringify([{ classId: 'c1', className: 'Maths' }]) });
    const fetchFn = jest.fn(async () => ok('pending'));

    const { approved } = await reconcileApprovals(ls, fetchFn, 'dev', '/api');

    expect(approved).toEqual([]);
    expect(getPendingClasses(ls)).toEqual([{ classId: 'c1', className: 'Maths' }]);
  });

  test('drops a pending class the server no longer has (404) so it cannot re-lock the join screen', async () => {
    const ls = makeStore({ [PENDING_KEY]: JSON.stringify([{ classId: 'c1', className: 'Maths' }]) });
    const fetchFn = jest.fn(async () => notFound());

    const { approved } = await reconcileApprovals(ls, fetchFn, 'dev', '/api');

    expect(approved).toEqual([]);
    expect(getPendingClasses(ls)).toEqual([]);
  });

  test('leaves pending in place on a transient server error (5xx)', async () => {
    const ls = makeStore({ [PENDING_KEY]: JSON.stringify([{ classId: 'c1', className: 'Maths' }]) });
    const fetchFn = jest.fn(async () => serverErr());

    await reconcileApprovals(ls, fetchFn, 'dev', '/api');

    expect(getPendingClasses(ls)).toEqual([{ classId: 'c1', className: 'Maths' }]);
  });

  test('is a no-op on fetch failure — pending is preserved for a later retry', async () => {
    const ls = makeStore({ [PENDING_KEY]: JSON.stringify([{ classId: 'c1', className: 'Maths' }]) });
    const fetchFn = jest.fn(async () => { throw new Error('offline'); });

    const { approved, newlyApproved } = await reconcileApprovals(ls, fetchFn, 'dev', '/api');

    expect(approved).toEqual([]);
    expect(newlyApproved).toEqual([]);
    expect(getPendingClasses(ls)).toEqual([{ classId: 'c1', className: 'Maths' }]);
  });
});
