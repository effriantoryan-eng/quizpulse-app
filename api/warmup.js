const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const quizzesContainer = database.container(process.env.COSMOS_CONTAINER_QUIZZES);

// Timer-triggered every 5 minutes to keep the Consumption-plan Function App from scaling to zero.
// The idle eviction window is ~20 min, so a fire every 5 min keeps the host process warm (which is
// what most cold-start latency is), and the cheap TOP-1 query keeps the Cosmos SDK connection pool
// warm too (the other slow part of a first request). Never throws — a warm failure is logged and
// swallowed, since nothing depends on its result.
//
// ponytail: this reduces cold starts, it doesn't eliminate them — the platform can still evict
// under memory pressure or a deploy. The real fix is Flex Consumption / an EP1 always-ready
// instance; move to that if cold-load complaints persist. This is the zero-extra-cost mitigation.
app.timer('warmup', {
  schedule: '0 */5 * * * *',
  handler: async (myTimer, context) => {
    try {
      await quizzesContainer.items.query({ query: 'SELECT TOP 1 VALUE c.id FROM c' }).fetchAll();
      context.log('warmup: host + Cosmos connection kept warm');
    } catch (err) {
      context.warn('warmup touch failed (non-fatal):', err.message);
    }
  },
});
