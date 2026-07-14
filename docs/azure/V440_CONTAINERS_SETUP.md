# v4.4.0 — Traffic Monitor Container Setup

`pageviews` is **not a new container** — it already exists in production, created at runtime by
the pre-v4.4.0 `api/pageView.js` via `database.containers.createIfNotExists()` (a defect this
sprint fixes; see CLAUDE.md's v4.4.0 [PLANNED] entry). This doc formalises it: verify it exists,
add a retention TTL, add a throughput cap, and switch it to the `COSMOS_CONTAINER_*` env-var
pattern every other container uses — the hardened `api/pageView.js` no longer self-creates it,
so this must be done **before** deploying the v4.4.0 API.

---

## Container — `pageviews`

| Property | Value |
|---|---|
| Container id | `pageviews` |
| Partition key | `/teacherId` (historical name — the field holds the anonymous visitor device UUID, not a real teacher) |
| Throughput | Serverless, with a **dedicated 400 RU/s cap** on this container only |
| Default TTL | 180 days (`15552000` seconds) |

### Why a dedicated RU cap (not just serverless like every other container)

`POST /api/pageView` is `authLevel: 'anonymous'` by design — it's a public beacon with no login.
Its only defense against a flood is an in-memory IP rate limit (`api/rateLimit.js`), which is
spoofable via `x-forwarded-for` on a direct call to the Function App URL. Without a cap, a
flood could burn enough Cosmos RU to trip the **100% budget threshold**, whose automation
runbook (`scripts/azure/disable-on-budget.ps1`) disables the **entire Function App** — not just
traffic logging. A container-scoped throughput cap turns that into a self-limiting nuisance:
once `pageviews` writes start getting throttled (429 from Cosmos), the beacon's fire-and-forget
`fetch(...).catch(() => {})` on the frontend just silently drops the write. Every other endpoint
keeps working.

### Portal steps

1. Azure Portal → **Cosmos DB** → `quizpulse-app-db-av5z18` → **Data Explorer**
2. Confirm the `pageviews` container already exists (it does — created by the pre-v4.4.0 code).
   If it's somehow missing, create it: Container id `pageviews`, partition key `/teacherId`.
3. Select the `pageviews` container → **Scale & Settings**
4. **Time to Live**: set to **On**, value `15552000` (180 days)
5. **Throughput**: switch from database-shared serverless to a **dedicated** setting on this
   container, cap at **400 RU/s** (Manual, or Autoscale with a 400 RU/s ceiling)
6. Click **Save**

### Function App config

```
COSMOS_CONTAINER_PAGEVIEWS = pageviews
```

Add under `quizpulse-app-api-av5z18` → Settings → Environment variables.

---

## Test Cosmos account (`quizpulse-int-test-db`)

Create the same container (pk `/teacherId`, TTL 180 days) in the dedicated integration-test
Cosmos account per CLAUDE.md's Testing section — a per-container RU cap is not necessary there
(no anonymous flood risk in a test-only account, and it would slow the test suite for no benefit).

```
COSMOS_CONTAINER_PAGEVIEWS = pageviews
```

Add to `api/local.settings.json` under `Values` alongside the existing `TEST_COSMOS_*` keys.

---

## local.settings.json update (for local dev)

```json
"COSMOS_CONTAINER_PAGEVIEWS": "pageviews"
```

---

## Verification

After provisioning, restart the Function App and smoke-test:

```bash
# Should return 201 { ok: true }
curl -X POST https://quizpulse-app-api-av5z18.azurewebsites.net/api/pageView \
  -H "Content-Type: application/json" \
  -d '{"page":"/","teacherId":"smoke-test","sessionId":"smoke-test"}'
```

If it returns 500, check `COSMOS_CONTAINER_PAGEVIEWS` is set and the container exists with the
correct partition key. If writes silently disappear under load, check the container's RU cap
isn't set too low for real pilot traffic — 400 RU/s is a starting point, not a permanent ceiling.
