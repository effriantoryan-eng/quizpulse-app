const { EXCLUDE_DEMO_FRAGMENT } = require('./excludeDemo');

// Range-scoped, demo-excluded quiz/response/push aggregates. Shared by api/traffic.js's
// funnel (which layers quizOpens on top via roster resolution) and api/metrics.js's
// usageGrowth/engagement de-stub (which doesn't need per-quiz roster resolution at all) — both
// need "quizzes sent in range, how many notifications went out, how many responses came back"
// and neither should re-type the EXCLUDE_DEMO_FRAGMENT query.
async function computeRangeQuizStats({ rangeStart, quizzesContainer, responsesContainer }) {
  const { resources: quizzesInRange } = await quizzesContainer.items.query({
    query: `SELECT c.id, c.classIds, c.pushSuccessCount, c.pushFailCount
            FROM c
            WHERE IS_DEFINED(c.sentAt) AND c.sentAt >= @rangeStart AND ${EXCLUDE_DEMO_FRAGMENT}`,
    parameters: [{ name: '@rangeStart', value: rangeStart.toISOString() }],
  }).fetchAll();

  const quizzesSent = quizzesInRange.length;

  // Legacy quizzes (sent before v4.4.0) have no pushSuccessCount/pushFailCount at all — excluded
  // from these sums rather than coerced to 0, which would inflate rates past 100% for any range
  // spanning the v4.4.0 deploy.
  const quizzesWithPushCounts = quizzesInRange.filter(q => typeof q.pushSuccessCount === 'number');
  const notificationsSent = quizzesWithPushCounts.reduce((sum, q) => sum + q.pushSuccessCount, 0);
  const notificationsFailed = quizzesWithPushCounts.reduce((sum, q) => sum + (q.pushFailCount || 0), 0);

  let responsesSubmitted = 0;
  if (quizzesInRange.length > 0) {
    const idParams = quizzesInRange.map((q, i) => ({ name: `@qid${i}`, value: q.id }));
    const idList = idParams.map(p => p.name).join(', ');
    const { resources } = await responsesContainer.items.query({
      query: `SELECT VALUE COUNT(1) FROM c WHERE c.quizId IN (${idList}) AND ${EXCLUDE_DEMO_FRAGMENT}`,
      parameters: idParams,
    }).fetchAll();
    responsesSubmitted = resources[0] || 0;
  }

  return { quizzesInRange, quizzesSent, notificationsSent, notificationsFailed, responsesSubmitted };
}

module.exports = { computeRangeQuizStats };
