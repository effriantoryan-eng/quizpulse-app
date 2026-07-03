# v4.0.0 — `population_benchmark` Container Setup

One new Cosmos DB container is required for population benchmarking (comprehensive analytics).
Create it manually before deploying the v4.0.0 API, then run the seed script once.

---

## Container — `population_benchmark`

Stores ~12 pre-aggregated topic-rollup documents (one per preset topic tag), written once by
`api/seed/populationSeed.js`. Not a raw response log — see
`DESIGN_REVIEW_v400_v410_addendum.md` §E1 for why this is pre-aggregated rather than raw synthetic
response docs in the `responses` container.

| Property | Value |
|---|---|
| Container id | `population_benchmark` |
| Partition key | `/topicTag` |
| Throughput | Serverless (same as other containers) |

### Portal steps

1. Azure Portal → **Cosmos DB** → `quizpulse-app-db-av5z18` → **Data Explorer**
2. Click **New Container**
3. Database id: select existing → `quizpulse-app-db`
4. Container id: `population_benchmark`
5. Partition key: `/topicTag`
6. Throughput: **Serverless**
7. Click **OK**

### Function App config

Add to Function App application settings (`quizpulse-app-api-av5z18` → Settings → Environment variables):

```
COSMOS_CONTAINER_POPULATION_BENCHMARK = population_benchmark
```

Also add the same key to `api/local.settings.json` for local dev (do not commit the file's secret
values — the key/value pair itself is not sensitive).

### Seeding

After the container exists and the env var is set, run once from the `api/` directory:

```powershell
cd api
node seed/populationSeed.js
```

The script is idempotent — it refuses to write if the container already has any documents, so it's
safe to leave in the deploy checklist without re-running accidentally. It seeds the 12 preset
topics from `api/shared/topicTags.js` with hardcoded per-topic correctness weights (see
`CORRECT_WEIGHT` in the script) — no live traffic required before benchmarking is demonstrable.
