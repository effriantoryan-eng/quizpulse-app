// v4.9.1 R1 (Stop the leaks) — unit tests for the idempotent student-data cleanup helpers
// (api/shared/studentDataCleanup.js) and the pure send-time subscription selector
// (selectEligibleSubscriptions in api/sendNotification.js).
//
// Fake containers are injected (no Cosmos, no func host), following tests/unit/api/firstRun.test.js.
// @azure/cosmos and web-push are mocked so this file can also import the real sendNotification.js
// (which constructs a CosmosClient at module load) for the selectEligibleSubscriptions case —
// the same technique demoSendNotification.test.js uses.
jest.mock('@azure/cosmos', () => ({ CosmosClient: class { database() { return { container() { return {}; } }; } } }));
jest.mock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification: jest.fn(async () => {}) }));

const crypto = require('crypto');
const { deleteSubscriptions, deleteJoinRequests, deidentifyResponses } = require('../../../api/shared/studentDataCleanup');
const { selectEligibleSubscriptions } = require('../../../api/sendNotification');
const { applyRejection } = require('../../../api/joinRequests');

// ---- fake container helpers ---------------------------------------------------------------------

function param(parameters, name) {
  const p = (parameters || []).find((x) => x.name === name);
  return p ? p.value : undefined;
}
function inValues(parameters, re) {
  return (parameters || []).filter((x) => re.test(x.name)).map((x) => x.value);
}

function makeSubscriptions(initial = []) {
  const map = new Map(initial.map((d) => [d.id, { ...d }]));
  return {
    _map: map,
    items: {
      query: ({ parameters }) => ({
        fetchAll: async () => {
          const cid = param(parameters, '@cid');
          const did = param(parameters, '@did');
          let rows = [...map.values()].filter((d) => d.classId === cid);
          if (did !== undefined) rows = rows.filter((d) => d.deviceId === did);
          return { resources: rows.map((d) => ({ id: d.id })) };
        },
      }),
    },
    item: (id) => ({
      delete: async () => {
        if (!map.has(id)) { const e = new Error('nf'); e.code = 404; throw e; }
        map.delete(id);
        return {};
      },
    }),
  };
}

function makeJoinRequests(initial = []) {
  const map = new Map(initial.map((d) => [d.id, { ...d }]));
  return {
    _map: map,
    items: {
      query: ({ query, parameters }) => ({
        fetchAll: async () => {
          if (query.includes("c.status = 'approved'")) {
            const ocs = inValues(parameters, /^@oc\d+$/);
            const dids = inValues(parameters, /^@d\d+$/);
            const rows = [...map.values()].filter(
              (d) => d.status === 'approved' && ocs.includes(d.classId) && dids.includes(d.deviceId),
            );
            return { resources: rows.map((d) => ({ deviceId: d.deviceId })) };
          }
          const cid = param(parameters, '@cid');
          const rows = [...map.values()].filter((d) => d.classId === cid);
          return { resources: rows.map((d) => ({ id: d.id })) };
        },
      }),
    },
    item: (id) => ({
      delete: async () => {
        if (!map.has(id)) { const e = new Error('nf'); e.code = 404; throw e; }
        map.delete(id);
        return {};
      },
    }),
  };
}

function makeQuizzes(initial = []) {
  const map = new Map(initial.map((d) => [d.id, { ...d }]));
  return {
    _map: map,
    items: {
      query: ({ parameters }) => ({
        fetchAll: async () => {
          const tid = param(parameters, '@tid');
          const cid = param(parameters, '@cid');
          const rows = [...map.values()].filter(
            (d) => d.teacherId === tid && (d.classIds || []).includes(cid),
          );
          return { resources: rows.map((d) => ({ id: d.id, classIds: d.classIds })) };
        },
      }),
    },
  };
}

function makeResponses(initial = []) {
  const map = new Map(initial.map((d) => [d.id, { ...d }]));
  return {
    _map: map,
    items: {
      create: async (doc) => {
        if (map.has(doc.id)) { const e = new Error('conflict'); e.code = 409; throw e; }
        map.set(doc.id, { ...doc });
        return { resource: doc };
      },
      query: ({ parameters }) => ({
        fetchAll: async () => {
          const qid = param(parameters, '@qid');
          const dids = inValues(parameters, /^@d\d+$/);
          const rows = [...map.values()].filter((d) => d.quizId === qid && dids.includes(d.studentId));
          return { resources: rows.map((d) => ({ ...d })) };
        },
      }),
    },
    item: (id) => ({
      patch: async (ops) => {
        const doc = map.get(id);
        if (!doc) { const e = new Error('nf'); e.code = 404; throw e; }
        for (const op of ops) if (op.op === 'set') doc[op.path.replace(/^\//, '')] = op.value;
        return { resource: doc };
      },
      delete: async () => {
        if (!map.has(id)) { const e = new Error('nf'); e.code = 404; throw e; }
        map.delete(id);
        return {};
      },
    }),
  };
}

const sha256 = (quizId, deviceId) => crypto.createHash('sha256').update(`${quizId}:${deviceId}`).digest('hex');

// ---- de-identify --------------------------------------------------------------------------------

describe('deidentifyResponses', () => {
  test('a removed device response is de-identified — a copy with a random id and studentId null exists; the original id is gone', async () => {
    const teacherId = 'T';
    const quizzes = makeQuizzes([{ id: 'Q', teacherId, classIds: ['C'] }]);
    const origId = sha256('Q', 'D');
    const responses = makeResponses([{ id: origId, quizId: 'Q', studentId: 'D', answers: [{ questionId: 'q1', selectedIndex: 0 }], completedAt: '2026-01-01' }]);
    const joinRequests = makeJoinRequests([]);

    const result = await deidentifyResponses(
      { quizzesContainer: quizzes, responsesContainer: responses, joinRequestsContainer: joinRequests },
      { teacherId, classId: 'C', deviceIds: ['D'] },
    );

    expect(result).toEqual({ deidentified: 1, skipped: 0 });
    expect(responses._map.has(origId)).toBe(false); // original gone
    const remaining = [...responses._map.values()];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].studentId).toBeNull();
    expect(remaining[0].deidentifiedAt).toBeTruthy();
    expect(remaining[0].deidPendingId).toBeUndefined(); // copy must not carry the transient marker
    expect(remaining[0].answers).toEqual([{ questionId: 'q1', selectedIndex: 0 }]); // counts preserved
  });

  test('the new id is not derived from the device — the two copies\' ids differ and neither equals or contains sha256(quizId:deviceId)', async () => {
    async function runOnce() {
      const quizzes = makeQuizzes([{ id: 'Q', teacherId: 'T', classIds: ['C'] }]);
      const responses = makeResponses([{ id: sha256('Q', 'D'), quizId: 'Q', studentId: 'D', answers: [] }]);
      await deidentifyResponses(
        { quizzesContainer: quizzes, responsesContainer: responses, joinRequestsContainer: makeJoinRequests([]) },
        { teacherId: 'T', classId: 'C', deviceIds: ['D'] },
      );
      return [...responses._map.values()][0].id;
    }
    const id1 = await runOnce();
    const id2 = await runOnce();
    const derived = sha256('Q', 'D');
    expect(id1).not.toBe(id2);
    for (const id of [id1, id2]) {
      expect(id).not.toBe(derived);
      expect(id.includes(derived)).toBe(false);
    }
  });

  test('a device still approved elsewhere is skipped — response untouched; skipped = 1', async () => {
    const teacherId = 'T';
    const quizzes = makeQuizzes([{ id: 'Q', teacherId, classIds: ['C1', 'C2'] }]);
    const origId = sha256('Q', 'D');
    const responses = makeResponses([{ id: origId, quizId: 'Q', studentId: 'D', answers: [] }]);
    // D is still approved in C2, which is also one of the quiz's target classes.
    const joinRequests = makeJoinRequests([{ id: 'jr2', classId: 'C2', deviceId: 'D', status: 'approved' }]);

    const result = await deidentifyResponses(
      { quizzesContainer: quizzes, responsesContainer: responses, joinRequestsContainer: joinRequests },
      { teacherId, classId: 'C1', deviceIds: ['D'] },
    );

    expect(result).toEqual({ deidentified: 0, skipped: 1 });
    expect(responses._map.has(origId)).toBe(true); // untouched
    expect(responses._map.get(origId).studentId).toBe('D');
  });

  test('a retry after a crash is idempotent — the create 409 is tolerated, the original is deleted, exactly one response remains', async () => {
    const teacherId = 'T';
    const quizzes = makeQuizzes([{ id: 'Q', teacherId, classIds: ['C'] }]);
    const origId = sha256('Q', 'D');
    const pendingId = crypto.randomUUID();
    // Crash state: original still present with a deidPendingId, AND the copy already created.
    const responses = makeResponses([
      { id: origId, quizId: 'Q', studentId: 'D', answers: [], deidPendingId: pendingId },
      { id: pendingId, quizId: 'Q', studentId: null, answers: [], deidentifiedAt: '2026-01-01' },
    ]);

    await deidentifyResponses(
      { quizzesContainer: quizzes, responsesContainer: responses, joinRequestsContainer: makeJoinRequests([]) },
      { teacherId, classId: 'C', deviceIds: ['D'] },
    );

    expect(responses._map.has(origId)).toBe(false);
    const remaining = [...responses._map.values()];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(pendingId);
    expect(remaining[0].studentId).toBeNull();
  });
});

// ---- delete subscriptions -----------------------------------------------------------------------

describe('deleteSubscriptions', () => {
  test('subscription delete is scoped — only (C,D1) removed', async () => {
    const subs = makeSubscriptions([
      { id: 's1', classId: 'C', deviceId: 'D1' },
      { id: 's2', classId: 'C', deviceId: 'D2' },
      { id: 's3', classId: 'C2', deviceId: 'D1' },
    ]);
    const deleted = await deleteSubscriptions({ subscriptionsContainer: subs }, { classId: 'C', deviceId: 'D1' });
    expect(deleted).toBe(1);
    expect(subs._map.has('s1')).toBe(false);
    expect(subs._map.has('s2')).toBe(true);
    expect(subs._map.has('s3')).toBe(true);
  });

  test('omitting deviceId deletes every subscription for the class — 2 removed, other class untouched', async () => {
    const subs = makeSubscriptions([
      { id: 's1', classId: 'C', deviceId: 'D1' },
      { id: 's2', classId: 'C', deviceId: 'D2' },
      { id: 's3', classId: 'C2', deviceId: 'D1' },
    ]);
    const deleted = await deleteSubscriptions({ subscriptionsContainer: subs }, { classId: 'C' });
    expect(deleted).toBe(2);
    expect(subs._map.has('s3')).toBe(true);
  });
});

describe('deleteJoinRequests', () => {
  test('deletes every join request for the class regardless of status', async () => {
    const jr = makeJoinRequests([
      { id: 'a', classId: 'C', status: 'approved' },
      { id: 'b', classId: 'C', status: 'rejected' },
      { id: 'c', classId: 'C2', status: 'approved' },
    ]);
    const deleted = await deleteJoinRequests({ joinRequestsContainer: jr }, { classId: 'C' });
    expect(deleted).toBe(2);
    expect(jr._map.has('c')).toBe(true);
  });
});

// ---- send-time selection (task 4) ---------------------------------------------------------------

describe('selectEligibleSubscriptions', () => {
  test('send selection drops unapproved devices — eligible = [D1]; stale = [D2]', () => {
    const subs = [
      { id: 's1', classId: 'C', deviceId: 'D1' },
      { id: 's2', classId: 'C', deviceId: 'D2' },
    ];
    const approvedByClass = new Map([['C', new Set(['D1'])]]);
    const { eligible, stale } = selectEligibleSubscriptions(subs, approvedByClass);
    expect(eligible.map((s) => s.deviceId)).toEqual(['D1']);
    expect(stale.map((s) => s.deviceId)).toEqual(['D2']);
  });

  test('a subscription for a class with no approved set at all is stale', () => {
    const subs = [{ id: 's1', classId: 'GONE', deviceId: 'D1' }];
    const { eligible, stale } = selectEligibleSubscriptions(subs, new Map());
    expect(eligible).toEqual([]);
    expect(stale.map((s) => s.id)).toEqual(['s1']);
  });
});

// ---- reject retention (task 5) ------------------------------------------------------------------

describe('applyRejection', () => {
  test('reject sets expiry — status rejected, ttl 604800', () => {
    const joinReq = { id: 'jr1', classId: 'C', deviceId: 'D', status: 'pending', studentName: 'A' };
    applyRejection(joinReq);
    expect(joinReq.status).toBe('rejected');
    expect(joinReq.ttl).toBe(604800);
    expect(joinReq.studentName).toBe('A'); // other fields untouched
  });
});
