// v4.6.0 Task 8 — activation funnel report. STANDALONE Node script (populationSeed.js
// convention): never reachable via HTTP, never runs automatically, run manually by the founder.
//
//   node api/scripts/activationFunnel.js
//
// Computes: signups, demo sends, first REAL sends, and median signup->first-real-send time, from
// teachers.createdAt + quizzes (explicit isDemo split, sentAt). Deliberately does NOT reuse
// api/shared/rangeQuizStats.js — that helper excludes demo quizzes entirely (EXCLUDE_DEMO_FRAGMENT),
// which would zero out the demo-send stage this funnel needs to report. This is a SANCTIONED
// exception to the house demo-isolation rule (CLAUDE.md), same category as misconception_intro's
// deliberate exception — the funnel's whole point is comparing demo vs. real activation.
const { CosmosClient } = require('@azure/cosmos');

// Pure aggregation over already-fetched docs — unit-testable without Cosmos. Spaced-repeat clones
// (parentQuizId set) are excluded from both buckets: a clone isn't a distinct "the teacher sent
// something" milestone, it's an automatic echo of an already-counted send.
function computeActivationFunnel({ teachers, quizzes }) {
  const signups = teachers.length;
  const firstSendByTeacher = new Map(); // teacherId -> { demoSentAt, realSentAt }

  for (const q of quizzes) {
    if (q.status !== 'sent' || !q.sentAt || q.parentQuizId) continue;
    const entry = firstSendByTeacher.get(q.teacherId) || {};
    const field = q.isDemo === true ? 'demoSentAt' : 'realSentAt';
    if (!entry[field] || q.sentAt < entry[field]) entry[field] = q.sentAt;
    firstSendByTeacher.set(q.teacherId, entry);
  }

  const entries = [...firstSendByTeacher.values()];
  const demoSends = entries.filter((e) => e.demoSentAt).length;
  const realSends = entries.filter((e) => e.realSentAt).length;

  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  const timeToFirstSendMs = [];
  for (const [teacherId, entry] of firstSendByTeacher) {
    if (!entry.realSentAt) continue;
    const teacher = teacherById.get(teacherId);
    if (!teacher?.createdAt) continue;
    const delta = new Date(entry.realSentAt).getTime() - new Date(teacher.createdAt).getTime();
    if (delta >= 0) timeToFirstSendMs.push(delta);
  }
  timeToFirstSendMs.sort((a, b) => a - b);
  const medianTimeToFirstSendMs = timeToFirstSendMs.length
    ? timeToFirstSendMs[Math.floor((timeToFirstSendMs.length - 1) / 2)]
    : null;

  return {
    signups,
    demoSends,
    realSends,
    demoSendRate: signups > 0 ? demoSends / signups : 0,
    realSendRate: signups > 0 ? realSends / signups : 0,
    medianTimeToFirstSendMs,
  };
}

function formatDuration(ms) {
  if (ms == null) return 'n/a';
  const hours = ms / 3600000;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

async function main() {
  const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
  });
  const database = client.database(process.env.COSMOS_DATABASE);
  const teachersContainer = database.container(process.env.COSMOS_CONTAINER_TEACHERS || 'teachers');
  const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);

  const [{ resources: teachers }, { resources: quizzes }] = await Promise.all([
    teachersContainer.items.query('SELECT c.id, c.createdAt FROM c').fetchAll(),
    quizzesContainer.items.query('SELECT c.teacherId, c.status, c.sentAt, c.isDemo, c.parentQuizId FROM c').fetchAll(),
  ]);

  const result = computeActivationFunnel({ teachers, quizzes });
  console.log('Activation funnel');
  console.log('------------------');
  console.log(`Signups:                 ${result.signups}`);
  console.log(`Demo sends:               ${result.demoSends} (${(result.demoSendRate * 100).toFixed(1)}%)`);
  console.log(`First real sends:         ${result.realSends} (${(result.realSendRate * 100).toFixed(1)}%)`);
  console.log(`Median signup->real send: ${formatDuration(result.medianTimeToFirstSendMs)}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('activationFunnel failed:', err);
    process.exit(1);
  });
}

module.exports = { computeActivationFunnel };
