// Milestone 5 — lists stray `integ-*` test documents that an earlier accidental integration run
// wrote into PRODUCTION Cosmos (see CLAUDE.md Testing section). Read-only by design: this script
// only lists candidates and never deletes — deletion from a student-data store is a judgment
// call for a human, not something to automate. Review the printed ids, then delete manually
// (Data Explorer or a follow-up one-off script) once confirmed safe.
//
//   node api/scripts/findStrayTestDocs.js
//
// Reads COSMOS_ENDPOINT/COSMOS_KEY from api/local.settings.json's Values (same as any other
// standalone script here) — point these at PRODUCTION deliberately, this is meant to run there.
const { CosmosClient } = require('@azure/cosmos');

const CONTAINERS = ['teachers', 'schools', 'classes', 'join_requests', 'responses'];
const STRAY_PATTERN = /^integ-/i;

function loadLocalSettings() {
  try {
    return require('../local.settings.json').Values || {};
  } catch {
    return {};
  }
}

async function main() {
  const env = { ...loadLocalSettings(), ...process.env };
  const client = new CosmosClient({ endpoint: env.COSMOS_ENDPOINT, key: env.COSMOS_KEY });
  const database = client.database(env.COSMOS_DATABASE);

  let totalFound = 0;
  for (const name of CONTAINERS) {
    const container = database.container(name);
    const { resources } = await container.items
      .query('SELECT c.id FROM c WHERE STARTSWITH(c.id, "integ-", true)')
      .fetchAll();
    totalFound += resources.length;
    console.log(`${name}: ${resources.length} stray doc(s)`);
    for (const r of resources.slice(0, 20)) console.log(`  - ${r.id}`);
    if (resources.length > 20) console.log(`  ... and ${resources.length - 20} more`);
  }
  console.log(`\nTotal: ${totalFound} stray doc(s) across ${CONTAINERS.length} containers.`);
  console.log('This script does not delete anything — review the ids above, then delete manually.');
}

main().catch((err) => {
  console.error('findStrayTestDocs failed:', err.message);
  process.exit(1);
});
