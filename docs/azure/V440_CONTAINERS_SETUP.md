# v4.4.0 — Traffic Monitor Container Setup

`pageviews` is **not a new container** — it already exists in production, created at runtime by
the pre-v4.4.0 `api/pageView.js` via `database.containers.createIfNotExists()` (a defect this
sprint fixes; see CLAUDE.md's v4.4.0 [PLANNED] entry). This doc formalises it: verify it exists,
add a retention TTL, and switch it to the `COSMOS_CONTAINER_*` env-var pattern every other
container uses — the hardened `api/pageView.js` no longer self-creates it, so this must be done
**before** deploying the v4.4.0 API.

---

## Container — `pageviews`

| Property | Value |
|---|---|
| Container id | `pageviews` |
| Partition key | `/teacherId` (historical name — the field holds the anonymous visitor device UUID, not a real teacher) |
| Throughput | Serverless — same as every other container in this account (see below) |
| Default TTL | 180 days (`15552000` seconds) |

### Correction: no per-container RU cap is possible on this account

**An earlier version of this doc called for a "dedicated 400 RU/s cap" on this container — that
is not achievable and the instruction was wrong.** `quizpulse-app-db-av5z18` is provisioned in
**Serverless capacity mode** (see CLAUDE.md's tech stack table). Serverless is an all-or-nothing
setting at the **account** level: no container in a serverless account can have its own
provisioned or autoscale throughput — there is no "Scale & Settings → Throughput" dial to find,
which is why you didn't see one. (Same category of mismatch as the APIM `rate-limit-by-key`
policy being rejected on Consumption tier — see CLAUDE.md Known issue #2.)

**What this means for the flood-defense goal:** `POST /api/pageView` is `authLevel: 'anonymous'`
with only an in-memory, spoofable IP rate limit (`api/rateLimit.js`) — that's unchanged and still
the real defense in practice. Without a container RU cap, a real flood would burn Cosmos RU
against the *whole account's* serverless bill rather than being contained to `pageviews`, up to
the $100/mo budget alert → the `disable-on-budget.ps1` runbook (which disables the entire
Function App, not just traffic logging). This residual risk is accepted for pilot scale; revisit
only if moving off serverless is ever justified for other reasons (e.g. sustained high traffic
across the whole app, where provisioned/autoscale throughput becomes cost-effective anyway).

### Portal steps

1. Azure Portal → **Cosmos DB** → `quizpulse-app-db-av5z18` → **Data Explorer**
2. Confirm the `pageviews` container already exists (it does — created by the pre-v4.4.0 code).
   If it's somehow missing, create it: Container id `pageviews`, partition key `/teacherId`.
3. Select the `pageviews` container → **Scale & Settings**
4. **Time to Live**: set to **On**, value `15552000` (180 days)
5. Click **Save** — there is no throughput setting to change on this container.

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
correct partition key. There is no per-container RU cap on this serverless account (see the
correction above) — if writes silently disappear under load, check the in-memory rate limit in
`api/rateLimit.js` and the account's overall RU consumption/budget alerts instead.
