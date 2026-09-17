# R1 (v4.9.1) — enable per-item TTL on `join_requests`

R1's reject path now stamps `ttl: 604800` (7 days) on a rejected join request
(`api/joinRequests.js`, `applyRejection`). A **per-item** `ttl` only takes effect once the
container's `DefaultTimeToLive` is switched on. We set it to **-1** ("On (no default)") so that
**only** items carrying an explicit `ttl` expire — every other join request (pending / approved /
queued, and legacy rejected requests with no `ttl`) is left untouched and never auto-expires.

The code deploys first: until TTL is enabled, the per-item `ttl` is silently ignored, so there is
no ordering hazard. Legacy rejected requests that predate R1 have no `ttl` and are cleaned up
separately by `api/scripts/cleanupOrphanedStudentData.js` (category d), not by this setting.

> Do NOT set a positive `DefaultTimeToLive` here — that would expire pending/approved requests too.
> `-1` is the required value.

## Production — `quizpulse-app-db-av5z18` (resource group `quizpulse-app-rg`)

```bash
az cosmosdb sql container update \
  --account-name quizpulse-app-db-av5z18 \
  --resource-group quizpulse-app-rg \
  --database-name quizpulse \
  --name join_requests \
  --ttl -1
```

If the CLI parses the negative value as a flag, use the `=` form: `--ttl=-1`.

Portal equivalent: Cosmos DB → `quizpulse-app-db-av5z18` → Data Explorer → `join_requests`
container → Settings → **Time to Live** → **On (no default)** → Save.

## Test — `quizpulse-int-test-db` (resource group `quizpulse-test-rg`)

Do this on the integration-test account too, so the R1 integration test's TTL expectations match
production behaviour.

```bash
az cosmosdb sql container update \
  --account-name quizpulse-int-test-db \
  --resource-group quizpulse-test-rg \
  --database-name quizpulse \
  --name join_requests \
  --ttl -1
```

## Verify (both accounts)

```bash
az cosmosdb sql container show \
  --account-name quizpulse-app-db-av5z18 \
  --resource-group quizpulse-app-rg \
  --database-name quizpulse \
  --name join_requests \
  --query "resource.defaultTtl"
```

Expected output: `-1`. (A `null`/absent value means TTL is still off and per-item `ttl` is being
ignored.) Repeat with `--account-name quizpulse-int-test-db --resource-group quizpulse-test-rg`
for the test account.
