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

// ---- v4.11.0 R2 (Erasure and opt-out) — higher-level erasure helpers ----------------------------
// A single generic in-memory container (point read/replace/delete/create + a tiny WHERE interpreter
// that covers the eq / != / IN / ARRAY_CONTAINS / COUNT / ORDER BY / OFFSET-LIMIT shapes these helpers
// issue). A shared opLog records mutations across every container, so cross-container ORDER assertions
// (cleanup before delete, teacher doc last, responses before quizzes) are exact.
const { removeStudentFromClass, eraseDevice, deleteTeacherAccount } = require('../../../api/shared/studentDataCleanup');

function mkC(name, initial = [], opLog = []) {
  const map = new Map(initial.map((d) => [d.id, { ...d }]));
  const paramsOf = (parameters) => Object.fromEntries((parameters || []).map((p) => [p.name, p.value]));
  function predicate(query, P) {
    const conds = [];
    for (const m of query.matchAll(/ARRAY_CONTAINS\(c\.(\w+),\s*(@\w+)\)/gi)) {
      const f = m[1]; const v = P[m[2]];
      conds.push((d) => Array.isArray(d[f]) && d[f].includes(v));
    }
    for (const m of query.matchAll(/c\.(\w+)\s+IN\s*\(([^)]*)\)/gi)) {
      const f = m[1]; const vals = (m[2].match(/@\w+/g) || []).map((n) => P[n]);
      conds.push((d) => vals.includes(d[f]));
    }
    for (const m of query.matchAll(/c\.(\w+)\s*!=\s*(@\w+)/gi)) {
      const f = m[1]; const v = P[m[2]];
      conds.push((d) => d[f] !== v);
    }
    for (const m of query.matchAll(/c\.(\w+)\s*=\s*(@\w+|'[^']*')/gi)) {
      const f = m[1]; const rhs = m[2]; const v = rhs[0] === '@' ? P[rhs] : rhs.slice(1, -1);
      conds.push((d) => d[f] === v);
    }
    return (d) => conds.every((c) => c(d));
  }
  return {
    _map: map,
    items: {
      create: async (doc) => {
        if (map.has(doc.id)) { const e = new Error('conflict'); e.code = 409; throw e; }
        map.set(doc.id, { ...doc }); opLog.push(`${name}:create:${doc.id}`);
        return { resource: { ...doc } };
      },
      query: ({ query, parameters }) => ({
        fetchAll: async () => {
          const P = paramsOf(parameters);
          let rows = [...map.values()].filter(predicate(query, P));
          if (/COUNT\(1\)/i.test(query)) return { resources: [rows.length] };
          if (/ORDER BY c\.createdAt ASC/i.test(query)) {
            rows = rows.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
          }
          const lim = query.match(/OFFSET\s+(\d+)\s+LIMIT\s+(\d+)/i);
          if (lim) rows = rows.slice(Number(lim[1]), Number(lim[1]) + Number(lim[2]));
          return { resources: rows.map((d) => ({ ...d })) };
        },
      }),
    },
    item: (id) => ({
      read: async () => ({ resource: map.has(id) ? { ...map.get(id) } : undefined }),
      replace: async (doc) => { map.set(id, { ...doc }); opLog.push(`${name}:replace:${id}`); return { resource: { ...doc } }; },
      delete: async () => {
        if (!map.has(id)) { const e = new Error('nf'); e.code = 404; throw e; }
        map.delete(id); opLog.push(`${name}:delete:${id}`); return {};
      },
      patch: async (patchOps) => {
        const doc = map.get(id);
        if (!doc) { const e = new Error('nf'); e.code = 404; throw e; }
        for (const op of patchOps) if (op.op === 'set') doc[op.path.replace(/^\//, '')] = op.value;
        return { resource: { ...doc } };
      },
    }),
  };
}

describe('removeStudentFromClass', () => {
  test('one shared implementation — cleanup runs before the join-request delete, studentCount decremented (floor 0), oldest queued request promoted', async () => {
    const log = [];
    const origId = sha256('Q', 'D');
    const containers = {
      classesContainer: mkC('cls', [{ id: 'C', teacherId: 'T', studentCount: 2 }], log),
      joinRequestsContainer: mkC('jr', [
        { id: 'jrA', classId: 'C', deviceId: 'D', teacherId: 'T', status: 'approved', createdAt: 't1' },
        { id: 'jrQ', classId: 'C', deviceId: 'D2', status: 'queued', createdAt: 't0' },
      ], log),
      subscriptionsContainer: mkC('subs', [{ id: 's1', classId: 'C', deviceId: 'D' }], log),
      quizzesContainer: mkC('quiz', [{ id: 'Q', teacherId: 'T', classIds: ['C'] }], log),
      responsesContainer: mkC('resp', [{ id: origId, quizId: 'Q', studentId: 'D', answers: [] }], log),
    };

    const result = await removeStudentFromClass(containers, { classId: 'C', joinRequestId: 'jrA' });

    expect(result).toMatchObject({ removed: true, promoted: true });
    // cleanup (subscription delete + response de-identify) precedes the join-request delete
    const jrDelete = log.indexOf('jr:delete:jrA');
    expect(log.indexOf('subs:delete:s1')).toBeLessThan(jrDelete);
    expect(log.indexOf(`resp:delete:${origId}`)).toBeLessThan(jrDelete);
    // studentCount decremented
    expect(containers.classesContainer._map.get('C').studentCount).toBe(1);
    // oldest queued promoted
    expect(containers.joinRequestsContainer._map.get('jrQ').status).toBe('pending');
    // join request gone; response de-identified (studentId null, original id gone), subscription gone
    expect(containers.joinRequestsContainer._map.has('jrA')).toBe(false);
    expect(containers.subscriptionsContainer._map.size).toBe(0);
    const resp = [...containers.responsesContainer._map.values()];
    expect(resp).toHaveLength(1);
    expect(resp[0].studentId).toBeNull();
  });

  test('studentCount floors at 0 — a decrement from 0 stays 0', async () => {
    const containers = {
      classesContainer: mkC('cls', [{ id: 'C', teacherId: 'T', studentCount: 0 }]),
      joinRequestsContainer: mkC('jr', [{ id: 'jrA', classId: 'C', deviceId: 'D', teacherId: 'T', status: 'approved' }]),
      subscriptionsContainer: mkC('subs', []),
      quizzesContainer: mkC('quiz', []),
      responsesContainer: mkC('resp', []),
    };
    await removeStudentFromClass(containers, { classId: 'C', joinRequestId: 'jrA' });
    expect(containers.classesContainer._map.get('C').studentCount).toBe(0);
  });

  test('a missing join request is a no-op — removed:false, nothing changes', async () => {
    const containers = {
      classesContainer: mkC('cls', [{ id: 'C', teacherId: 'T', studentCount: 1 }]),
      joinRequestsContainer: mkC('jr', []),
      subscriptionsContainer: mkC('subs', []),
      quizzesContainer: mkC('quiz', []),
      responsesContainer: mkC('resp', []),
    };
    const result = await removeStudentFromClass(containers, { classId: 'C', joinRequestId: 'gone' });
    expect(result.removed).toBe(false);
    expect(containers.classesContainer._map.get('C').studentCount).toBe(1);
  });
});

describe('eraseDevice', () => {
  test('device erasure reaches every container — responses hard-deleted (no studentId-null copy), subscriptions, both join requests and pageviews gone, approved class decremented, counts returned', async () => {
    const containers = {
      responsesContainer: mkC('resp', [{ id: 'r1', quizId: 'Q', studentId: 'D', answers: [] }]),
      subscriptionsContainer: mkC('subs', [{ id: 's1', classId: 'C', deviceId: 'D' }]),
      joinRequestsContainer: mkC('jr', [
        { id: 'jrApproved', classId: 'C', deviceId: 'D', teacherId: 'T', status: 'approved', createdAt: 't1' },
        { id: 'jrRejected', classId: 'C2', deviceId: 'D', status: 'rejected' },
      ]),
      pageviewsContainer: mkC('pv', [{ id: 'p1', teacherId: 'D' }, { id: 'p2', teacherId: 'D' }]),
      classesContainer: mkC('cls', [{ id: 'C', teacherId: 'T', studentCount: 1 }]),
      quizzesContainer: mkC('quiz', [{ id: 'Q', teacherId: 'T', classIds: ['C'] }]),
    };

    const counts = await eraseDevice(containers, { deviceId: 'D' });

    expect(counts).toEqual({ responses: 1, subscriptions: 1, joinRequests: 2, pageviews: 2 });
    expect(containers.responsesContainer._map.size).toBe(0); // hard-deleted, no null-copy left behind
    expect(containers.subscriptionsContainer._map.size).toBe(0);
    expect(containers.joinRequestsContainer._map.size).toBe(0);
    expect(containers.pageviewsContainer._map.size).toBe(0);
    expect(containers.classesContainer._map.get('C').studentCount).toBe(0);
  });
});

describe('deleteTeacherAccount', () => {
  function fullAccount(log) {
    return {
      teachersContainer: mkC('teachers', [{ id: 'T', schoolId: 'S', role: 'teacher' }], log),
      quizzesContainer: mkC('quiz', [{ id: 'Q1', teacherId: 'T' }], log),
      responsesContainer: mkC('resp', [{ id: 'r1', quizId: 'Q1', studentId: 'D' }], log),
      classesContainer: mkC('cls', [{ id: 'C', teacherId: 'T', studentCount: 0 }], log),
      subscriptionsContainer: mkC('subs', [{ id: 's1', classId: 'C', deviceId: 'D' }], log),
      joinRequestsContainer: mkC('jr', [{ id: 'jr1', classId: 'C', deviceId: 'D', status: 'approved' }], log),
      questionsContainer: mkC('qn', [{ id: 'qn1', teacherId: 'T' }], log),
      upvotesContainer: mkC('uv', [], log),
      reportsContainer: mkC('rep', [], log),
      sourceMaterialsContainer: mkC('src', [{ id: 'src1', teacherId: 'T' }], log),
      quizDraftsContainer: mkC('drafts', [{ id: 'd1', teacherId: 'T' }], log),
      schoolsContainer: mkC('schools', [{ id: 'S', status: 'validated' }], log),
    };
  }

  test('teacher document is deleted last and responses before their quizzes — full account removed, validated school kept', async () => {
    const log = [];
    const containers = fullAccount(log);

    const counts = await deleteTeacherAccount(containers, { teacherId: 'T' });

    expect(log[log.length - 1]).toBe('teachers:delete:T');
    expect(log.indexOf('resp:delete:r1')).toBeLessThan(log.indexOf('quiz:delete:Q1'));
    expect(counts).toMatchObject({ quizzes: 1, responses: 1, classes: 1, questions: 1, sources: 1, drafts: 1, teacher: 1 });
    for (const key of ['teachersContainer', 'quizzesContainer', 'responsesContainer', 'classesContainer', 'subscriptionsContainer', 'joinRequestsContainer', 'questionsContainer', 'sourceMaterialsContainer', 'quizDraftsContainer']) {
      expect(containers[key]._map.size).toBe(0);
    }
    expect(containers.schoolsContainer._map.has('S')).toBe(true); // validated → kept
  });

  test('retry after a mid-cascade crash completes — no errors from already-deleted docs', async () => {
    const containers = fullAccount([]);
    // Make the first response delete throw a transient (non-404) error, then succeed on retry.
    let failed = false;
    const realItem = containers.responsesContainer.item.bind(containers.responsesContainer);
    containers.responsesContainer.item = (id) => {
      const it = realItem(id);
      const realDelete = it.delete;
      it.delete = async () => {
        if (!failed) { failed = true; const e = new Error('boom'); e.code = 500; throw e; }
        return realDelete();
      };
      return it;
    };

    await expect(deleteTeacherAccount(containers, { teacherId: 'T' })).rejects.toThrow('boom');
    // rerun — completes cleanly, no throw on already-deleted docs
    const counts = await deleteTeacherAccount(containers, { teacherId: 'T' });
    expect(counts.teacher).toBe(1);
    expect(containers.teachersContainer._map.size).toBe(0);
    expect(containers.responsesContainer._map.size).toBe(0);
    expect(containers.quizzesContainer._map.size).toBe(0);
  });

  test('school handling — only the lone unvalidated school is deleted', async () => {
    const teachers = mkC('teachers', [
      { id: 'T1', schoolId: 'S1' }, { id: 'T1b', schoolId: 'S1' }, // S1 unvalidated, shared
      { id: 'T2', schoolId: 'S2' },                               // S2 unvalidated, alone
      { id: 'T3', schoolId: 'S3' },                               // S3 validated, alone
    ]);
    const schools = mkC('schools', [
      { id: 'S1', status: 'unvalidated' },
      { id: 'S2', status: 'unvalidated' },
      { id: 'S3', status: 'validated' },
    ]);
    const empties = () => ({
      quizzesContainer: mkC('quiz', []), responsesContainer: mkC('resp', []), classesContainer: mkC('cls', []),
      subscriptionsContainer: mkC('subs', []), joinRequestsContainer: mkC('jr', []), questionsContainer: mkC('qn', []),
      upvotesContainer: mkC('uv', []), reportsContainer: mkC('rep', []), sourceMaterialsContainer: mkC('src', []),
      quizDraftsContainer: mkC('drafts', []),
    });

    const c1 = await deleteTeacherAccount({ ...empties(), teachersContainer: teachers, schoolsContainer: schools }, { teacherId: 'T1' });
    const c2 = await deleteTeacherAccount({ ...empties(), teachersContainer: teachers, schoolsContainer: schools }, { teacherId: 'T2' });
    const c3 = await deleteTeacherAccount({ ...empties(), teachersContainer: teachers, schoolsContainer: schools }, { teacherId: 'T3' });

    expect(c1.school).toBe(0); // shared unvalidated → kept
    expect(c2.school).toBe(1); // lone unvalidated → deleted
    expect(c3.school).toBe(0); // validated → kept
    expect(schools._map.has('S1')).toBe(true);
    expect(schools._map.has('S2')).toBe(false);
    expect(schools._map.has('S3')).toBe(true);
  });

  test('upvote counts stay consistent — the upvoted question drops to 0, a missing question is tolerated', async () => {
    const questions = mkC('qn', [{ id: 'QX', teacherId: 'AUTHOR', upvoteCount: 1 }]);
    const containers = {
      teachersContainer: mkC('teachers', [{ id: 'U' }]), // no schoolId
      upvotesContainer: mkC('uv', [
        { id: 'uv1', questionId: 'QX', teacherId: 'U' },
        { id: 'uv2', questionId: 'GONE', teacherId: 'U' },
      ]),
      questionsContainer: questions,
      quizzesContainer: mkC('quiz', []), responsesContainer: mkC('resp', []), classesContainer: mkC('cls', []),
      subscriptionsContainer: mkC('subs', []), joinRequestsContainer: mkC('jr', []), reportsContainer: mkC('rep', []),
      sourceMaterialsContainer: mkC('src', []), quizDraftsContainer: mkC('drafts', []), schoolsContainer: mkC('schools', []),
    };

    const counts = await deleteTeacherAccount(containers, { teacherId: 'U' });

    expect(counts.upvotes).toBe(2);
    expect(questions._map.get('QX').upvoteCount).toBe(0);
    expect(containers.upvotesContainer._map.size).toBe(0); // both upvotes removed, GONE tolerated
  });
});
