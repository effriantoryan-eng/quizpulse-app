# v4.6.0 — Step Zero Runbook (go/no-go gate)

One page for the whole step-zero gate from `CC_PROMPTS_v460.md`. Run this BEFORE any v4.6.0
code.

**Track A (custom domain) — DROPPED by explicit decision, 2026-07-27.** Not deferred, not
pending — out of scope for v4.6.0/v4.6.1. E2's join screen uses the `azurestaticapps.net`
origin permanently, with QR mandatory (the plan's own documented fallback). See the note under
"Track A" below. Everything that remains is **Track B**, the code gate.

Each item ends with a **verdict** and a **pre-decided casualty** if it fails — so a failure
narrows scope instead of blocking the sprint.

> ⚠️ Read before running any `az` command here: these are written from the standard SWA +
> Entra External ID flow, not read live from your subscription. Eyeball each against the Azure
> Portal / your resource names before running. Resource names use suffix `av5z18`; resource
> group `quizpulse-app-rg`; Function App `quizpulse-app-api-av5z18`; SWA `quizpulse-app-swa`;
> Cosmos account `quizpulse-app-db-av5z18` (Serverless — **no per-container RU cap exists**,
> don't try to set one). Deploy the API only from Node 20/22, never 24.

---

## TRACK A — Custom domain: DROPPED (2026-07-27)

Explicit user decision, not a slipped deadline: the custom domain is out of scope. E2's join
screen (v4.6.1) permanently uses the `azurestaticapps.net` origin, with QR mandatory (rather
than optional/eng-vetoable as originally spec'd). No DNS, CIAM redirect-URI, or CSP work is
needed. If this is reconsidered later, the original steps (SWA custom domain, dual-registered
redirect URIs, CSP additions) are standard SWA + Entra External ID flow and can be re-derived
then — no need to preserve them here.

---

## TRACK B — Code gate (same session, before v4.6.0 code)

### B1. v4.3 container verification + E1 dogfood

**Containers + env vars — DONE, confirmed 2026-07-27.**
- Production (`quizpulse-app-db-av5z18`): `source_materials`/`quiz_drafts` exist (CLAUDE.md
  `[CURRENT — v4.3.0]`, user-verified).
- Test Cosmos (`quizpulse-int-test-db`): both containers confirmed present via Data Explorer
  (screenshot review, 2026-07-27) — visible alongside `audit_log`, `classes`, `pageviews`,
  `population_benchmark`, `questions`, `quizzes`, `responses`, `schools`, `teachers`, etc.
- Function App env vars on production: confirmed set.

No provisioning work remains. `V430_CONTAINERS_SETUP.md` stays as reference only.

**E1 dogfood (founder, manual) — the only open item in B1.** This was never about container
existence — it's about the generation pipeline actually working end-to-end against a live
deploy, which CLAUDE.md still flags as open. On the DEPLOYED site, go to `/teacher/generate` and
upload **3 real worksheets** (a PDF, a .docx, a .txt). For each, confirm: text extracted (not
"scanned/too short"), a draft of sensible questions returned, and — critically — the questions
read as **editable starting points**, not gibberish (the mock provider is template-shaped by
design). Then upload one **~15MB** file and confirm the SWA linked-backend proxy passes it
through without truncation (this path was only verified locally in v4.3, never against a live
deploy).

**VERDICT:** 3 dogfoods produce editable drafts + 15MB upload succeeds → E1 is in scope.
**CASUALTY if either fails:** E1 (the doc-upload lane in the finale) DROPS from v4.6.0 and goes
to TODOS with the failure noted. The finale ships **fast-lane-only** — and Task 4 must build the
finale UI to work with the E1 lane absent regardless, so this failure costs nothing else.

**DONE — 2026-07-27. E1 is IN SCOPE.** Ran live against production via the Browser pane, signed
in as the founder account:
- `.txt` (Photosynthesis, Year 8 Science) → "1 sections read ✓" → 5 editable questions drafted.
- `.docx` (Ancient Rome, Year 8 History) → "1 sections read ✓" (mammoth) → 5 editable questions.
- `.pdf` (Cell Biology, Year 9 Science) → "1 pages read ✓" (unpdf) → 5 editable questions.
- ~14.5MB `.txt` proxy check → `POST /api/generation/sources` → `201`, "150 sections read ✓ —
  we read as much as we could fit" (truncated, expected). SWA linked-backend proxy confirmed
  live — no truncation, no timeout, no stall. This path was previously only verified locally.

Two non-blocking content-quality observations logged to TODOS (mock provider's stopword/dedup
logic occasionally lets a plural/case variant or a generic connector word appear as a distractor
option) — cosmetic, doesn't affect the go/no-go verdict.

### B2. v4.4 pageviews TTL + integration tests

**TTL + env var — DONE, 2026-07-27. Verified/fixed directly via `az` CLI** (skipped the portal —
`az` was already authenticated, so no manual clicking needed):
1. Production `pageviews` TTL — **already correctly set**, `defaultTtl: 15552000` (180 days),
   confirmed via `az cosmosdb sql container show`.
2. Production Function App env var `COSMOS_CONTAINER_PAGEVIEWS=pageviews` — **already set**,
   confirmed via `az functionapp config appsettings list`.
3. Test Cosmos (`quizpulse-int-test-db`) `pageviews` TTL — **was genuinely missing**
   (`defaultTtl: null`, container already had 184 docs from earlier test runs but no retention
   policy). Fixed: `az cosmosdb sql container update --account-name quizpulse-int-test-db
   --resource-group quizpulse-test-rg --database-name quizpulse --name pageviews --ttl 15552000`.
   Fresh-read verified afterward: `15552000` on both accounts.

**Run the 14 v4.4 integration tests** (Known issue #14) — **DONE, 2026-07-27, 14/14 PASS.**
```bash
cd api
$env:COSMOS_ENDPOINT = (Get-Content local.settings.json | ConvertFrom-Json).Values.TEST_COSMOS_ENDPOINT
$env:COSMOS_KEY = (Get-Content local.settings.json | ConvertFrom-Json).Values.TEST_COSMOS_KEY
func start
# then, scoped to the v4.4.0 suite (running the whole tests/integration/ directory pulls in
# other pre-existing suites with their own unrelated preconditions — out of scope here):
RUN_INTEGRATION=true npx jest --config jest.config.cjs tests/integration/api/v440-traffic.test.js
```
Stop that host afterward — normal `func start` (no overrides) resumes pointing at production.

**Root cause found and fixed along the way:** the first run threw 9/14 false failures, every
one an admin-audience `401` (even on tests that don't check role, e.g. the audience-gate test
itself). Cause: `jest.config.cjs` had no `setupFiles`, so neither `npm run test:integration` nor
a direct `npx jest` call ever loaded `api/local.settings.json`'s `Values` into the jest
process's env. The test file mints tokens with `aud: process.env.ADMIN_AUTH_CLIENT_ID ||
'admin-client-id'` — with the real env var unset in the jest process, every minted token fell
back to the placeholder string, while the `func` host (which DOES load `local.settings.json`)
expected the real client-id GUID. Audience mismatch → `authenticateAdmin` rejects → `401`,
before any role-gate logic ever ran. **Fixed properly, not worked around:** added
`tests/setup/loadLocalSettingsEnv.js` (loads `local.settings.json`'s `Values` into
`process.env` for integration runs only, never overriding a value already set — same precedence
CLAUDE.md documents for the Functions host itself) and wired it into `jest.config.cjs`'s new
`setupFiles`. Re-verified with a fresh `func` host and a clean shell (no manual exports): 14/14
pass via the exact documented command. `tests/reports/v4.4.0-report.html` regenerated to reflect
this (a stray full-`tests/integration/` run earlier polluted it with unrelated pre-existing
suite failures — ignore that; not in scope for B2/Known-issue-#14).

**VERDICT:** TTL set + env var present (portal, still your action) + integration tests pass
(done) → go, pending your portal confirmation.
**CASUALTY if the pageviews step fails:** the E4 activation script is UNAFFECTED (it reads
`teachers`/`quizzes` only, never `pageviews`), so v4.6.0 core proceeds; but Known-issue-#14
closure slips — fix before the pilot.

### B3. CLAUDE.md truth pass

v4.1–v4.4 ARE merged into `main` and tagged (git-verified 2026-07-27) — the "not yet merged"
status blurbs in CLAUDE.md were stale.

**DONE, 2026-07-27.** Corrected every stale claim, backed by hard evidence, not inference:
- Re-confirmed via git: `v4.1.0`–`v4.4.0` all merged into `main`, all tagged.
- Confirmed via `az functionapp function list` against the LIVE production Function App: every
  v4.1–v4.4 endpoint (`evidenceExport`, `updateProfile`, `generationSources`,
  `manageTraffic`/`pageView`, etc.) is actually deployed and callable — not just merged to git.
- Also caught (same category of staleness, cheap to fix while in there): the top-of-file
  current-state line (was still anchored on v4.0.0), the v4.0.0 blurb's stale
  `population_benchmark` "deploy blocker" (already resolved per the doc's own Known Issues
  section — confirmed the container exists via `az cosmosdb sql container show`), the branch
  tree's `[PLANNED]` tags on already-merged release branches, the v4.4.0 implementation note's
  "still pending: tag v4.4.0-rc1..." (already tagged), the feature status table's "not yet
  deployed" rows, and Known issues #13/#14 (struck through + marked Resolved, matching the
  doc's own convention for #8–#12).
- Zero remaining `not yet merged`/`not yet deployed`/`still pending` matches in CLAUDE.md
  (verified by grep after the edit pass).

**VERDICT:** blurbs corrected → go. Not yet committed — review the diff and commit when ready.
**CASUALTY:** none — this is pure doc hygiene, always do it.

---

## Gate summary — proceed to v4.6.0 code when:

- [x] **B1 containers/env vars** — done, confirmed 2026-07-27 (prod + test-db + Function App)
- [x] **B1 E1 dogfood** — done, confirmed 2026-07-27 (3 worksheets + 15MB proxy, all PASS)
- [x] **B2 integration tests** — done, 2026-07-27 (14/14 pass; root cause of 9 false failures
      found and fixed — `tests/setup/loadLocalSettingsEnv.js` + `jest.config.cjs`)
- [x] **B2 pageviews TTL** — done, 2026-07-27, via `az` CLI (prod TTL + env var were already
      correct; test-db TTL was genuinely missing, fixed and verified)
- [x] **B3** CLAUDE.md status blurbs corrected — done, 2026-07-27
- [x] **Track A (custom domain)** — DROPPED, 2026-07-27 (not applicable; see note above)

**Track B (the code gate) is fully closed — B1, B2, and B3 all done, 2026-07-27.** Track A
(custom domain) is dropped. **Step zero is complete. v4.6.0 code can start.**

Only the B2 portal TTL step and B3 (doc hygiene) remain before v4.6.0 code.
