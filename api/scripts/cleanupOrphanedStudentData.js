// v4.9.1 R1 (Stop the leaks) Task 7 — one-off cleanup of student data already orphaned in
// production by past class deletes / student removals (which, before R1, left join requests,
// subscriptions and responses behind). STANDALONE Node script (populationSeed.js /
// activationFunnel.js convention): never reachable via HTTP, never runs automatically, run
// manually by the founder.
//
//   node api/scripts/cleanupOrphanedStudentData.js            # dry run (default) — reports only
//   node api/scripts/cleanupOrphanedStudentData.js --apply    # mutate
//
// Run it against quizpulse-int-test-db FIRST (CLAUDE.md Testing section env overrides), then do a
// dry run against production, get the counts signed off, and only then --apply. Cross-partition
// scans are acceptable here — this is a one-off founder script, not a hot path.
const { CosmosClient } = require('@azure/cosmos');
const { deidentifyOneResponse } = require('../shared/studentDataCleanup');

const REJECTED_TTL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function sample(ids, n = 5) {
  return ids.slice(0, n).join(', ') || '(none)';
}

// Cross-partition scans (one-off founder script). Returns the four orphan sets and, if apply is
// true, fixes them reusing task 1's de-identification primitive. Returns { found, applied }.
async function main({ apply = process.argv.includes('--apply') } = {}) {
  const endpoint = process.env.COSMOS_ENDPOINT || '';
  let host;
  try { host = new URL(endpoint).host; } catch { host = '(unparseable endpoint)'; }
  console.log(`Cosmos endpoint host: ${host}`);
  console.log(`Mode: ${apply ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);
  console.log('');

  const client = new CosmosClient({ endpoint, key: process.env.COSMOS_KEY });
  const database = client.database(process.env.COSMOS_DATABASE);
  const classesContainer = database.container(process.env.COSMOS_CONTAINER_CLASSES || 'classes');
  const joinRequestsContainer = database.container(process.env.COSMOS_CONTAINER_JOIN_REQUESTS || 'join_requests');
  const subscriptionsContainer = database.container(process.env.COSMOS_CONTAINER_SUBSCRIPTIONS || 'subscriptions');
  const responsesContainer = database.container(process.env.COSMOS_CONTAINER_RESPONSES || 'responses');
  const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES || 'quizzes');

  // Reference sets
  const { resources: classes } = await classesContainer.items.query('SELECT c.id FROM c').fetchAll();
  const classIds = new Set(classes.map((c) => c.id));

  const { resources: joinReqs } = await joinRequestsContainer.items
    .query('SELECT c.id, c.classId, c.deviceId, c.status, c.ttl, c.createdAt FROM c').fetchAll();
  const approvedPair = new Set();               // "classId::deviceId" for approved enrolments
  const approvedClassesByDevice = new Map();    // deviceId -> Set(classId) of approved enrolments
  for (const j of joinReqs) {
    if (j.status !== 'approved') continue;
    approvedPair.add(`${j.classId}::${j.deviceId}`);
    if (!approvedClassesByDevice.has(j.deviceId)) approvedClassesByDevice.set(j.deviceId, new Set());
    approvedClassesByDevice.get(j.deviceId).add(j.classId);
  }

  const { resources: subs } = await subscriptionsContainer.items
    .query('SELECT c.id, c.classId, c.deviceId FROM c').fetchAll();
  const { resources: quizzes } = await quizzesContainer.items
    .query('SELECT c.id, c.classIds FROM c').fetchAll();
  const quizClassIds = new Map(quizzes.map((q) => [q.id, q.classIds || []]));
  const { resources: responses } = await responsesContainer.items.query('SELECT * FROM c').fetchAll();

  // (a) join_requests whose classId has no class document
  const orphanJoinReqs = joinReqs.filter((j) => !classIds.has(j.classId));

  // (d) rejected join requests in a still-live class, older than 7 days, with no ttl (legacy — the
  //     dead-class ones are already covered by (a))
  const cutoff = new Date(Date.now() - REJECTED_TTL_WINDOW_MS).toISOString();
  const staleRejected = joinReqs.filter(
    (j) => classIds.has(j.classId) && j.status === 'rejected' && !j.ttl && j.createdAt && j.createdAt < cutoff,
  );

  // (b) subscriptions whose class is gone, or whose device has no approved join request for that class
  const orphanSubs = subs.filter(
    (s) => !classIds.has(s.classId) || !approvedPair.has(`${s.classId}::${s.deviceId}`),
  );

  // (c) responses whose device has no approved join request in ANY of the quiz's target classes.
  //     Skip demo/simulated (generated device ids, not real students) and already-de-identified.
  const orphanResponses = responses.filter((r) => {
    if (r.studentId == null) return false;
    if (r.isDemo === true || r.simulated === true) return false;
    const qClasses = quizClassIds.get(r.quizId) || [];
    const approved = approvedClassesByDevice.get(r.studentId) || new Set();
    return !qClasses.some((cid) => approved.has(cid));
  });

  const found = {
    orphanJoinRequests: orphanJoinReqs.length,
    orphanSubscriptions: orphanSubs.length,
    responsesToDeidentify: orphanResponses.length,
    staleRejected: staleRejected.length,
  };

  console.log(`(a) orphaned join_requests (class gone):        ${found.orphanJoinRequests}   e.g. ${sample(orphanJoinReqs.map((j) => j.id))}`);
  console.log(`(b) orphaned subscriptions:                     ${found.orphanSubscriptions}   e.g. ${sample(orphanSubs.map((s) => s.id))}`);
  console.log(`(c) responses to de-identify (no live enrol):   ${found.responsesToDeidentify}   e.g. ${sample(orphanResponses.map((r) => r.id))}`);
  console.log(`(d) stale rejected join_requests (>7d, no ttl): ${found.staleRejected}   e.g. ${sample(staleRejected.map((j) => j.id))}`);

  if (!apply) {
    console.log('\nDry run — no changes made. Re-run with --apply once the counts are signed off.');
    return { found, applied: null };
  }

  console.log('\nApplying...');
  const applied = { orphanJoinRequests: 0, orphanSubscriptions: 0, responsesDeidentified: 0, staleRejected: 0 };

  // ponytail: single-doc deletes are inline (404-tolerant, same idempotency as the shared helpers) —
  // the whole-class deleteJoinRequests/deleteSubscriptions helpers don't fit arbitrary individual
  // orphans, and per-orphan calls would re-query each time. Category (c) DOES reuse the shared
  // de-identification primitive, which is the piece worth sharing.
  for (const j of [...orphanJoinReqs, ...staleRejected]) {
    try {
      await joinRequestsContainer.item(j.id, j.classId).delete();
      if (j.status === 'rejected' && classIds.has(j.classId)) applied.staleRejected++;
      else applied.orphanJoinRequests++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }
  for (const s of orphanSubs) {
    try {
      await subscriptionsContainer.item(s.id, s.classId).delete();
      applied.orphanSubscriptions++;
    } catch (err) {
      if (err.code !== 404) throw err;
    }
  }
  const now = new Date().toISOString();
  for (const r of orphanResponses) {
    await deidentifyOneResponse(responsesContainer, r.quizId, r, now);
    applied.responsesDeidentified++;
  }

  console.log(
    `Done. join_requests deleted: ${applied.orphanJoinRequests} (a) + ${applied.staleRejected} (d); ` +
    `subscriptions deleted: ${applied.orphanSubscriptions} (b); responses de-identified: ${applied.responsesDeidentified} (c).`,
  );
  return { found, applied };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('cleanupOrphanedStudentData failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
