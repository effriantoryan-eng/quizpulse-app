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

module.exports = { deleteSubscriptions, deleteJoinRequests, deidentifyResponses };
