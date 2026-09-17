// v4.9.1 R1 (Stop the leaks) Task 1 — shared, idempotent student-data cleanup used by the
// class-delete cascade (classes.js), remove-student (classes.js), send-time approval pruning
// (sendNotification.js) and the one-off orphan-cleanup script (scripts/cleanupOrphanedStudentData.js).
//
// Every function takes its Cosmos containers as arguments (the testable, deps-injected shape of
// shared/firstRun.js) so the unit tests can drive them with fakes and no Cosmos.
//
// Idempotency is by construction: a 404 on delete or a 409 on create means "already done", so a
// request retried after a partial failure finishes without duplicating anything. All multi-document
// writes are sequential awaits (house rule — no Promise.all).
const crypto = require('crypto');

// Cosmos system fields must not be copied into a fresh create() — they're server-managed and would
// otherwise carry a stale _etag / _rid identity onto the new document.
function stripSystemFields(doc) {
  const { _etag, _rid, _self, _attachments, _ts, ...rest } = doc;
  return rest;
}

// Delete push subscriptions for a class. In-partition (subscriptions pk /classId). deviceId is
// optional: omit it to delete every subscription for the class (class-delete cascade); pass it to
// delete one device's subscription (remove-student). Returns the count actually deleted.
async function deleteSubscriptions({ subscriptionsContainer }, { classId, deviceId }) {
  const query = deviceId
    ? 'SELECT c.id FROM c WHERE c.classId = @cid AND c.deviceId = @did'
    : 'SELECT c.id FROM c WHERE c.classId = @cid';
  const parameters = deviceId
    ? [{ name: '@cid', value: classId }, { name: '@did', value: deviceId }]
    : [{ name: '@cid', value: classId }];

  const { resources } = await subscriptionsContainer.items.query({ query, parameters }).fetchAll();
  let deleted = 0;
  for (const sub of resources) {
    try {
      await subscriptionsContainer.item(sub.id, classId).delete();
      deleted++;
    } catch (err) {
      if (err.code !== 404) throw err; // 404 = already gone (a concurrent/retried delete)
    }
  }
  return deleted;
}

// Delete every join request for a class, any status. In-partition (join_requests pk /classId).
// Returns the count actually deleted.
async function deleteJoinRequests({ joinRequestsContainer }, { classId }) {
  const { resources } = await joinRequestsContainer.items.query({
    query: 'SELECT c.id FROM c WHERE c.classId = @cid',
    parameters: [{ name: '@cid', value: classId }],
  }).fetchAll();
  let deleted = 0;
  for (const jr of resources) {
    try {
      await joinRequestsContainer.item(jr.id, classId).delete();
      deleted++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }
  return deleted;
}

// De-identify a single response: patch a random deidPendingId (if absent), create a copy under that
// id with studentId null, then delete the original. Split into three idempotent steps so a crash at
// any point leaves a state a rerun can finish. The new id is a fresh random UUID, NOT derived from
// the original id (which is sha256(quizId:deviceId)) — any derived id would be recomputable from the
// device ID, which defeats de-identification.
async function deidentifyOneResponse(responsesContainer, quizId, resp, now) {
  // 1) ensure the response carries a random deidPendingId
  let pendingId = resp.deidPendingId;
  if (!pendingId) {
    pendingId = crypto.randomUUID();
    await responsesContainer.item(resp.id, quizId).patch([
      { op: 'set', path: '/deidPendingId', value: pendingId },
    ]);
  }

  // 2) create the de-identified copy: id = deidPendingId, studentId null, deidentifiedAt now, every
  // other field unchanged except deidPendingId (which the copy must not carry).
  const copy = stripSystemFields(resp);
  delete copy.deidPendingId;
  copy.id = pendingId;
  copy.studentId = null;
  copy.deidentifiedAt = now;
  try {
    await responsesContainer.items.create(copy);
  } catch (err) {
    if (err.code !== 409) throw err; // 409 = copy already created on a prior attempt
  }

  // 3) delete the original
  try {
    await responsesContainer.item(resp.id, quizId).delete();
  } catch (err) {
    if (err.code !== 404) throw err; // 404 = original already deleted on a prior attempt
  }
}

// De-identify a set of devices' responses to a class's quizzes. Keeps the teacher's per-question
// counts intact (the response is re-created, only its device link is severed) while leaving nothing
// that ties an answer back to a child.
//
// A response is SKIPPED when its device still holds an APPROVED join request in another class that
// is also one of that quiz's target classes — that answer still belongs to a live enrolment. The
// "another class" exclusion is load-bearing: at cascade/remove-student time the class being cleaned
// still has its own join requests (they're deleted last, for retry-safety), so a check that didn't
// exclude the current class would always match the device's own request there and skip everything.
async function deidentifyResponses(
  { quizzesContainer, responsesContainer, joinRequestsContainer },
  { teacherId, classId, deviceIds },
) {
  const devices = [...new Set((deviceIds || []).filter(Boolean))];
  if (devices.length === 0) return { deidentified: 0, skipped: 0 };

  // a) quizzes that targeted this class, in-partition (quizzes pk /teacherId)
  const { resources: quizzes } = await quizzesContainer.items.query({
    query: 'SELECT c.id, c.classIds FROM c WHERE c.teacherId = @tid AND ARRAY_CONTAINS(c.classIds, @cid)',
    parameters: [{ name: '@tid', value: teacherId }, { name: '@cid', value: classId }],
  }).fetchAll();

  const now = new Date().toISOString();
  let deidentified = 0;
  let skipped = 0;

  for (const quiz of quizzes) {
    // c) devices still approved in ANOTHER of this quiz's target classes → their answers stay linked
    const otherClasses = (quiz.classIds || []).filter((id) => id !== classId);
    let approvedElsewhere = new Set();
    if (otherClasses.length > 0) {
      const cidParams = otherClasses.map((id, i) => ({ name: `@oc${i}`, value: id }));
      const didParams = devices.map((d, i) => ({ name: `@d${i}`, value: d }));
      const { resources: approvedRows } = await joinRequestsContainer.items.query({
        query: `SELECT c.deviceId FROM c WHERE c.status = 'approved' AND c.classId IN (${cidParams
          .map((p) => p.name)
          .join(', ')}) AND c.deviceId IN (${didParams.map((p) => p.name).join(', ')})`,
        parameters: [...cidParams, ...didParams],
      }).fetchAll();
      approvedElsewhere = new Set(approvedRows.map((r) => r.deviceId));
    }

    // b) this quiz's responses from the target devices (responses pk /quizId). A copy already made
    // on a prior attempt has studentId null and so is never re-selected here.
    const didParams = devices.map((d, i) => ({ name: `@d${i}`, value: d }));
    const { resources: responses } = await responsesContainer.items.query({
      query: `SELECT * FROM c WHERE c.quizId = @qid AND c.studentId IN (${didParams
        .map((p) => p.name)
        .join(', ')})`,
      parameters: [{ name: '@qid', value: quiz.id }, ...didParams],
    }).fetchAll();

    for (const resp of responses) {
      if (approvedElsewhere.has(resp.studentId)) {
        skipped++;
        continue;
      }
      await deidentifyOneResponse(responsesContainer, quiz.id, resp, now);
      deidentified++;
    }
  }

  return { deidentified, skipped };
}

// ---- v4.11.0 R2 (Erasure and opt-out) -----------------------------------------------------------
// Higher-level operations built on the R1 primitives above. Containers are always passed in (never
// constructed here) so the unit tests drive them with fakes. Deletes tolerate 404, creates tolerate
// 409, and the parent document is deleted LAST, so a request retried after a partial failure finishes
// the job without duplicating or orphaning anything.

// Remove one student's enrolment from one class. The SINGLE implementation shared by teacher removal
// (classes.js classesRemoveStudent), student self-leave (studentPrivacy.js) and owner device erasure
// (eraseDevice below). Reads the join request itself (by classId + joinRequestId) so callers only pass
// ids. R1 cleanup (subscription delete + response de-identification) runs BEFORE the join request is
// deleted, so a retry after a mid-cleanup crash still finds the (approved) request and re-runs the
// idempotent cleanup. `containers` needs: classes, joinRequests, subscriptions, quizzes, responses.
async function removeStudentFromClass(
  { classesContainer, joinRequestsContainer, subscriptionsContainer, quizzesContainer, responsesContainer },
  { classId, joinRequestId },
) {
  // item().read() resolves { resource: undefined } for a missing item in this SDK (see the firstRun
  // getOrCreateQuiz fix) — check truthiness, keep the 404 catch as a secondary guard.
  let joinReq;
  try {
    const { resource } = await joinRequestsContainer.item(joinRequestId, classId).read();
    joinReq = resource;
  } catch (err) {
    if (err.code !== 404) throw err;
  }
  if (!joinReq) {
    return { removed: false, subscriptions: 0, deidentified: 0, skipped: 0, promoted: false };
  }

  const { deviceId, teacherId } = joinReq;

  // 1) R1 cleanup, BEFORE the join request is deleted. In the eraseDevice path these are both no-ops
  //    (responses already hard-deleted, subscription already deleted) — deidentifyResponses selects by
  //    studentId, which no longer matches, and deleteSubscriptions finds nothing.
  const subscriptions = await deleteSubscriptions({ subscriptionsContainer }, { classId, deviceId });
  const { deidentified, skipped } = await deidentifyResponses(
    { quizzesContainer, responsesContainer, joinRequestsContainer },
    { teacherId, classId, deviceIds: [deviceId] },
  );

  // 2) delete the join request
  try {
    await joinRequestsContainer.item(joinRequestId, classId).delete();
  } catch (err) {
    if (err.code !== 404) throw err;
  }

  // 3) decrement studentCount (floor 0). Advisory counter — a mid-crash retry that no longer finds the
  //    join request skips this, same non-idempotency the original handler had; the floor guards double
  //    decrements. class pk is /teacherId.
  try {
    const { resource: cls } = await classesContainer.item(classId, teacherId).read();
    if (cls) {
      cls.studentCount = Math.max(0, (cls.studentCount || 0) - 1);
      await classesContainer.item(classId, teacherId).replace(cls);
    }
  } catch (err) {
    if (err.code !== 404) throw err;
  }

  // 4) promote the oldest queued request to pending (a different device — never this one)
  let promoted = false;
  const { resources: queued } = await joinRequestsContainer.items.query({
    query: "SELECT * FROM c WHERE c.classId = @cid AND c.status = 'queued' ORDER BY c.createdAt ASC OFFSET 0 LIMIT 1",
    parameters: [{ name: '@cid', value: classId }],
  }).fetchAll();
  if (queued.length > 0) {
    const promote = queued[0];
    promote.status = 'pending';
    await joinRequestsContainer.item(promote.id, classId).replace(promote);
    promoted = true;
  }

  return { removed: true, subscriptions, deidentified, skipped, promoted };
}

// Erase every trace of one device — an explicit erasure request, so a HARD delete of responses (not
// de-identification). Order is load-bearing. `containers` needs: responses, subscriptions,
// joinRequests, pageviews, plus (via removeStudentFromClass) classes and quizzes.
async function eraseDevice(containers, { deviceId }) {
  const { responsesContainer, subscriptionsContainer, joinRequestsContainer, pageviewsContainer } = containers;
  const counts = { responses: 0, subscriptions: 0, joinRequests: 0, pageviews: 0 };

  // 1) responses (cross-partition by studentId) — HARD delete. MUST run first: removeStudentFromClass
  //    (step 3) de-identifies responses to studentId null, which this device query can no longer find,
  //    so de-identifying first would strand un-erasable copies.
  const { resources: responses } = await responsesContainer.items.query({
    query: 'SELECT c.id, c.quizId FROM c WHERE c.studentId = @sid',
    parameters: [{ name: '@sid', value: deviceId }],
  }).fetchAll();
  for (const r of responses) {
    try {
      await responsesContainer.item(r.id, r.quizId).delete();
      counts.responses++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // 2) subscriptions (cross-partition by deviceId)
  const { resources: subs } = await subscriptionsContainer.items.query({
    query: 'SELECT c.id, c.classId FROM c WHERE c.deviceId = @did',
    parameters: [{ name: '@did', value: deviceId }],
  }).fetchAll();
  for (const s of subs) {
    try {
      await subscriptionsContainer.item(s.id, s.classId).delete();
      counts.subscriptions++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // 3) approved join requests → removeStudentFromClass (deletes the JR, decrements studentCount,
  //    promotes the queue; its cleanup is now a no-op).
  const { resources: approved } = await joinRequestsContainer.items.query({
    query: "SELECT c.id, c.classId FROM c WHERE c.deviceId = @did AND c.status = 'approved'",
    parameters: [{ name: '@did', value: deviceId }],
  }).fetchAll();
  for (const jr of approved) {
    const res = await removeStudentFromClass(containers, { classId: jr.classId, joinRequestId: jr.id });
    if (res.removed) counts.joinRequests++;
  }

  // 4) remaining join requests for the device, any status (rejected, queued, pending) — hard delete
  const { resources: remaining } = await joinRequestsContainer.items.query({
    query: 'SELECT c.id, c.classId FROM c WHERE c.deviceId = @did',
    parameters: [{ name: '@did', value: deviceId }],
  }).fetchAll();
  for (const jr of remaining) {
    try {
      await joinRequestsContainer.item(jr.id, jr.classId).delete();
      counts.joinRequests++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // 5) pageviews: pk /teacherId actually holds the device UUID (v4.4.0 funnel). Delete the whole
  //    partition.
  const { resources: pvs } = await pageviewsContainer.items.query({
    query: 'SELECT c.id FROM c WHERE c.teacherId = @did',
    parameters: [{ name: '@did', value: deviceId }],
  }, { partitionKey: deviceId }).fetchAll();
  for (const pv of pvs) {
    try {
      await pageviewsContainer.item(pv.id, deviceId).delete();
      counts.pageviews++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  return counts;
}

// Hard-delete a whole teacher account. Ordered, idempotent, teacher document LAST. `containers` needs:
// quizzes, responses, classes, subscriptions, joinRequests, questions, upvotes, reports,
// sourceMaterials, quizDrafts, schools, teachers. Never touches audit_log (append-only by design).
async function deleteTeacherAccount(containers, { teacherId }) {
  const {
    quizzesContainer, responsesContainer, classesContainer, subscriptionsContainer, joinRequestsContainer,
    questionsContainer, upvotesContainer, reportsContainer, sourceMaterialsContainer, quizDraftsContainer,
    schoolsContainer, teachersContainer,
  } = containers;
  const counts = {
    quizzes: 0, responses: 0, classes: 0, subscriptions: 0, joinRequests: 0, questions: 0,
    upvotes: 0, reports: 0, sources: 0, drafts: 0, school: 0, teacher: 0,
  };

  // quizzes (pk /teacherId): every response in the quiz's partition first, then the quiz.
  const { resources: quizzes } = await quizzesContainer.items.query({
    query: 'SELECT c.id FROM c WHERE c.teacherId = @tid',
    parameters: [{ name: '@tid', value: teacherId }],
  }, { partitionKey: teacherId }).fetchAll();
  for (const q of quizzes) {
    const { resources: resp } = await responsesContainer.items.query({
      query: 'SELECT c.id FROM c WHERE c.quizId = @qid',
      parameters: [{ name: '@qid', value: q.id }],
    }, { partitionKey: q.id }).fetchAll();
    for (const r of resp) {
      try {
        await responsesContainer.item(r.id, q.id).delete();
        counts.responses++;
      } catch (err) {
        if (err.code !== 404) throw err;
      }
    }
    try {
      await quizzesContainer.item(q.id, teacherId).delete();
      counts.quizzes++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // classes (pk /teacherId): R1 cascade (subscriptions + join requests) then the class.
  const { resources: classes } = await classesContainer.items.query({
    query: 'SELECT c.id FROM c WHERE c.teacherId = @tid',
    parameters: [{ name: '@tid', value: teacherId }],
  }, { partitionKey: teacherId }).fetchAll();
  for (const cls of classes) {
    counts.subscriptions += await deleteSubscriptions({ subscriptionsContainer }, { classId: cls.id });
    counts.joinRequests += await deleteJoinRequests({ joinRequestsContainer }, { classId: cls.id });
    try {
      await classesContainer.item(cls.id, teacherId).delete();
      counts.classes++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // questions authored by the teacher (pk /teacherId).
  const { resources: questions } = await questionsContainer.items.query({
    query: 'SELECT c.id FROM c WHERE c.teacherId = @tid',
    parameters: [{ name: '@tid', value: teacherId }],
  }, { partitionKey: teacherId }).fetchAll();
  for (const qn of questions) {
    try {
      await questionsContainer.item(qn.id, teacherId).delete();
      counts.questions++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // question_upvotes MADE by this teacher (cross-partition; pk /questionId). Delete each, then
  // decrement the upvoted question's advisory upvoteCount (floor 0; tolerate a deleted question — its
  // partition key is the AUTHOR's teacherId, which the upvote doc doesn't carry, so find it by id).
  // ponytail: advisory count — a mid-crash retry can miss one decrement; floor 0 keeps it sane.
  const { resources: upvotes } = await upvotesContainer.items.query({
    query: 'SELECT c.id, c.questionId FROM c WHERE c.teacherId = @tid',
    parameters: [{ name: '@tid', value: teacherId }],
  }).fetchAll();
  for (const uv of upvotes) {
    let reallyDeleted = false;
    try {
      await upvotesContainer.item(uv.id, uv.questionId).delete();
      reallyDeleted = true;
      counts.upvotes++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
    if (reallyDeleted) {
      const { resources: qrows } = await questionsContainer.items.query({
        query: 'SELECT * FROM c WHERE c.id = @qid',
        parameters: [{ name: '@qid', value: uv.questionId }],
      }).fetchAll();
      const question = qrows[0];
      if (question) {
        question.upvoteCount = Math.max(0, (question.upvoteCount || 0) - 1);
        await questionsContainer.item(question.id, question.teacherId).replace(question);
      }
    }
  }

  // question_reports made by this teacher (cross-partition; pk /questionId).
  const { resources: reports } = await reportsContainer.items.query({
    query: 'SELECT c.id, c.questionId FROM c WHERE c.teacherId = @tid',
    parameters: [{ name: '@tid', value: teacherId }],
  }).fetchAll();
  for (const rp of reports) {
    try {
      await reportsContainer.item(rp.id, rp.questionId).delete();
      counts.reports++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // source_materials and quiz_drafts (both pk /teacherId) — data removal only, no generation logic.
  const { resources: sources } = await sourceMaterialsContainer.items.query({
    query: 'SELECT c.id FROM c WHERE c.teacherId = @tid',
    parameters: [{ name: '@tid', value: teacherId }],
  }, { partitionKey: teacherId }).fetchAll();
  for (const s of sources) {
    try {
      await sourceMaterialsContainer.item(s.id, teacherId).delete();
      counts.sources++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }
  const { resources: drafts } = await quizDraftsContainer.items.query({
    query: 'SELECT c.id FROM c WHERE c.teacherId = @tid',
    parameters: [{ name: '@tid', value: teacherId }],
  }, { partitionKey: teacherId }).fetchAll();
  for (const d of drafts) {
    try {
      await quizDraftsContainer.item(d.id, teacherId).delete();
      counts.drafts++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }

  // school: delete only if it's unvalidated AND no OTHER teacher shares it. The teacher doc is deleted
  // last, so it's still present here — exclude it from the "other teachers" count.
  let schoolId = null;
  try {
    const { resource: teacherDoc } = await teachersContainer.item(teacherId, teacherId).read();
    schoolId = teacherDoc?.schoolId || null;
  } catch (err) {
    if (err.code !== 404) throw err;
  }
  if (schoolId) {
    let school = null;
    try {
      const { resource } = await schoolsContainer.item(schoolId, schoolId).read();
      school = resource;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
    if (school && school.status === 'unvalidated') {
      const { resources: otherCounts } = await teachersContainer.items.query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.schoolId = @sid AND c.id != @tid',
        parameters: [{ name: '@sid', value: schoolId }, { name: '@tid', value: teacherId }],
      }).fetchAll();
      if ((otherCounts[0] || 0) === 0) {
        try {
          await schoolsContainer.item(schoolId, schoolId).delete();
          counts.school = 1;
        } catch (err) {
          if (err.code !== 404) throw err;
        }
      }
    }
  }

  // teacher document LAST — so a retry before this point re-runs the whole cascade idempotently.
  try {
    await teachersContainer.item(teacherId, teacherId).delete();
    counts.teacher = 1;
  } catch (err) {
    if (err.code !== 404) throw err;
  }

  return counts;
}

// deidentifyOneResponse is exported for the orphan-cleanup script (R1 task 7), whose category (c)
// selects responses per-response rather than per (classId, deviceIds), so it reuses this primitive
// directly instead of deidentifyResponses.
module.exports = {
  deleteSubscriptions,
  deleteJoinRequests,
  deidentifyResponses,
  deidentifyOneResponse,
  removeStudentFromClass,
  eraseDevice,
  deleteTeacherAccount,
};
