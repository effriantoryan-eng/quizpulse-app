// Population benchmark seed — v4.0.0 comprehensive analytics.
//
// Writes ~12 pre-aggregated topic-rollup documents to the `population_benchmark` container, one
// per preset topic tag. This is a STANDALONE Node script, not an Azure Function — it is never
// reachable via HTTP and never runs automatically. Run manually, once, after the
// population_benchmark container is provisioned (see docs/azure/POPULATION_BENCHMARK_SETUP.md).
//
//   node api/seed/populationSeed.js
//
// Design note (see DESIGN_REVIEW_v400_v410_addendum.md §E1): the original sprint plan seeded
// ~37,500 RAW synthetic response docs into the transactional `responses` container, which the
// Population page would then cross-partition-scan on every load. Instead we write the seed
// pre-aggregated — one small rollup doc per topic — because this is fixed synthetic benchmark
// data that is only ever read at topic level, never re-sliced. `GET /api/analytics/population`
// does a single point-read against this container per topic load.
//
// Idempotent: if the container already has any docs, exits with a warning and writes nothing.

const { CosmosClient } = require('@azure/cosmos');
const { TOPIC_TAGS } = require('../shared/topicTags');

// Per-topic correctness weight — hardcoded so benchmarking is non-trivial (some topics harder
// than others), mirroring the sprint plan's seed parameters.
const CORRECT_WEIGHT = {
  'Year 7 Science': 0.68, 'Year 8 Science': 0.64, 'Year 9 Science': 0.60, 'Year 10 Science': 0.58,
  'Year 11 Maths': 0.52, 'Year 12 Maths': 0.49,
  'Year 7 English': 0.71, 'Year 8 English': 0.67, 'Year 9 English': 0.63, 'Year 10 English': 0.60,
  'Year 7 Humanities': 0.66, 'Year 9 Humanities': 0.59,
};

// Confidence distribution matching v3.3.0 simulate parameters: 40% sure, 40% pretty_sure, 20% guessing.
const CONFIDENT_SHARE = 0.80; // sure + pretty_sure
const RESPONSES_PER_TOPIC = 3125; // ~100 schools x ~3 quizzes x ~25 students x ~5 questions / 12 topics, rounded

function buildRollup(topic) {
  const pctCorrect = Math.round(CORRECT_WEIGHT[topic] * 1000) / 10; // one decimal, as a percentage
  // Confident-but-incorrect share of ALL answers: P(incorrect) * P(confident) — independent by
  // construction of the synthetic model.
  const pctConfidentIncorrect = Math.round((1 - CORRECT_WEIGHT[topic]) * CONFIDENT_SHARE * 1000) / 10;
  return {
    id: topic,
    topicTag: topic,
    responseCount: RESPONSES_PER_TOPIC,
    pctCorrect,
    pctConfidentIncorrect,
    seededAt: new Date().toISOString(),
  };
}

async function main() {
  const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY,
  });
  const database = client.database(process.env.COSMOS_DATABASE);
  const container = database.container(process.env.COSMOS_CONTAINER_POPULATION_BENCHMARK || 'population_benchmark');

  const { resources: existingCount } = await container.items
    .query('SELECT VALUE COUNT(1) FROM c')
    .fetchAll();
  if ((existingCount[0] || 0) > 0) {
    console.warn(`population_benchmark already has ${existingCount[0]} document(s) — refusing to reseed. Safe to re-run only on a clean container.`);
    return;
  }

  const docs = TOPIC_TAGS.map(buildRollup);
  await Promise.all(docs.map((d) => container.items.create(d)));
  console.log(`Seeded ${docs.length} population_benchmark rollup document(s).`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('populationSeed failed:', err);
    process.exit(1);
  });
}

module.exports = { buildRollup, CORRECT_WEIGHT };
