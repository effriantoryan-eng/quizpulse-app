// v4.12.0 R3 (Notice, consent & minimisation) — one-off purge of the browser-fingerprint fields
// (referrer, userAgent, language, timezone, screenWidth, screenHeight) that Task 1's code change
// stops storing GOING FORWARD, but which still sit on every pageviews doc written before this
// release (up to 180 days' worth, per the container TTL). Closes the audit's B2 finding fully —
// otherwise "we don't fingerprint before consent" is true of new writes only, while old docs still
// link a device UUID (later a child's join_requests deviceId) to their browser fingerprint.
//
// STANDALONE Node script (populationSeed.js / cleanupOrphanedStudentData.js convention): never
// reachable via HTTP, never runs automatically, run manually by the founder.
//
//   node api/scripts/purgePageviewFingerprints.js            # dry run (default) — reports only
//   node api/scripts/purgePageviewFingerprints.js --apply    # mutate
//
// Run against quizpulse-int-test-db first (CLAUDE.md Testing section env overrides), then a dry
// run against production, get the count signed off, then --apply.
const { CosmosClient } = require('@azure/cosmos');

const FINGERPRINT_FIELDS = ['referrer', 'userAgent', 'language', 'timezone', 'screenWidth', 'screenHeight'];

async function main({ apply = process.argv.includes('--apply') } = {}) {
  const endpoint = process.env.COSMOS_ENDPOINT || '';
  let host;
  try { host = new URL(endpoint).host; } catch { host = '(unparseable endpoint)'; }
  console.log(`Cosmos endpoint host: ${host}`);
  console.log(`Mode: ${apply ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);
  console.log('');

  const client = new CosmosClient({ endpoint, key: process.env.COSMOS_KEY });
  const database = client.database(process.env.COSMOS_DATABASE);
  const pageviewsContainer = database.container(process.env.COSMOS_CONTAINER_PAGEVIEWS || 'pageviews');

  // A doc still carrying at least one raw fingerprint field (any of the six is non-null) is a
  // pre-R3 doc. New docs never set these at all. Cross-partition scan — acceptable for a one-off.
  const { resources: docs } = await pageviewsContainer.items
    .query(`SELECT c.id, c.teacherId FROM c WHERE
      IS_DEFINED(c.referrer) OR IS_DEFINED(c.userAgent) OR IS_DEFINED(c.language) OR
      IS_DEFINED(c.timezone) OR IS_DEFINED(c.screenWidth) OR IS_DEFINED(c.screenHeight)`)
    .fetchAll();

  console.log(`Docs still carrying a fingerprint field: ${docs.length}`);

  if (!apply) {
    console.log('\nDry run — no changes made. Re-run with --apply once the count is signed off.');
    return { found: docs.length, applied: null };
  }

  console.log('\nApplying...');
  let applied = 0;
  for (const d of docs) {
    try {
      await pageviewsContainer.item(d.id, d.teacherId).patch(
        FINGERPRINT_FIELDS.map((path) => ({ op: 'remove', path: `/${path}` })),
      );
      applied++;
    } catch (err) {
      // A field already absent on this particular doc makes 'remove' 400 — tolerate and move on,
      // since the goal (no fingerprint field left) is already true for that doc.
      if (err.code !== 400 && err.code !== 404) throw err;
    }
  }

  console.log(`Done. Fingerprint fields removed from ${applied} of ${docs.length} docs.`);
  return { found: docs.length, applied };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('purgePageviewFingerprints failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
