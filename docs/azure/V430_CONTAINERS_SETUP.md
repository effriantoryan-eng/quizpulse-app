# v4.3.0 — AI Quiz Generation Container Setup

Two new containers are required before deploying any v4.3.0 API code: `source_materials` and
`quiz_drafts`. Both must exist in production **and** in the isolated integration-test Cosmos
account (`quizpulse-int-test-db`) before `test:integration` is run — this project has already
written test data to production once by skipping that step (see CLAUDE.md's Testing section).

---

## Container — `source_materials`

Extracted text + chunk metadata from a teacher-uploaded document. **The original binary is never
stored** — only the extracted text and chunk boundaries, per the sprint's hard privacy/copyright
constraint.

| Property | Value |
|---|---|
| Container id | `source_materials` |
| Partition key | `/teacherId` |
| Throughput | Serverless (same as other containers) |
| Default TTL | **On, 90 days** (`7776000` seconds) — a source stops being usable for new drafts/expansion after this; existing questions keep their resolved `sourceRefLabel` regardless (see CLAUDE.md's Lineage note) |

### Portal steps

1. Azure Portal → **Cosmos DB** → `quizpulse-app-db-av5z18` → **Data Explorer**
2. **New Container** → Container id `source_materials`, partition key `/teacherId`, throughput
   **Serverless**
3. Container → **Scale & Settings** → **Time to Live**: **On**, value `7776000` (90 days)
4. Click **Save**

### Function App config

```
COSMOS_CONTAINER_SOURCE_MATERIALS = source_materials
```

---

## Container — `quiz_drafts`

A generated-but-not-yet-approved quiz draft: questions array (with per-question `reviewed`
flags), the source it came from, and generation metadata.

| Property | Value |
|---|---|
| Container id | `quiz_drafts` |
| Partition key | `/teacherId` |
| Throughput | Serverless |
| Default TTL | None — a draft is either approved (materialised into real question/quiz docs and
  can be discarded) or abandoned; nothing here needs auto-expiry |

### Portal steps

1. **New Container** → Container id `quiz_drafts`, partition key `/teacherId`, throughput
   **Serverless**

### Function App config

```
COSMOS_CONTAINER_QUIZ_DRAFTS = quiz_drafts
```

---

## Test Cosmos account (`quizpulse-int-test-db`)

Create both containers with the same partition keys (`source_materials` TTL 90 days,
`quiz_drafts` no TTL) in the dedicated integration-test account before running
`RUN_INTEGRATION=true npm run test:integration` against v4.3.0's suite.

```
COSMOS_CONTAINER_SOURCE_MATERIALS = source_materials
COSMOS_CONTAINER_QUIZ_DRAFTS = quiz_drafts
```

Add both to `api/local.settings.json` under `Values`, alongside the existing `TEST_COSMOS_*` keys.

---

## Upload path — SWA proxy / `request.formData()` spike (task 0, before feat/v4.3-source-upload)

`POST /api/generation/sources` accepts a multipart upload up to 15MB. Two things need
verification before relying on the SWA Standard linked-backend proxy for this one endpoint:

1. **SWA Standard's linked-backend proxy has an undocumented request-size ceiling** that may be
   lower than 15MB — verify with a real large-file POST against the deployed SWA origin (not
   `localhost:7071` directly) once this ships. If the proxy rejects/truncates it, this endpoint
   falls back to the **direct Function App URL** pattern (same one the pre-Sprint-6 API used
   generally, documented exception — see CLAUDE.md's API routing section) for this route only.
2. **Azure Functions v4's `request.formData()` has a documented large-field truncation issue**
   (GitHub `azure-functions-nodejs-library` #206) on some hosting configurations. If a local
   15MB multipart POST against `func start` truncates the file field, `api/generationSources.js`
   switches to **`busboy`** for streaming multipart parsing instead of `request.formData()`.

**Status of this spike in the current build session:** verified locally against `func start`
(`request.formData()` correctly received a 15MB test payload without truncation — see
`tests/integration/api/v4.3-source-upload.test.js`'s large-file case). **Not yet verified against
the deployed SWA proxy** — that requires a live deployment and is out of scope for a local dev
session. Do this verification before the v4.3.0 upload endpoint goes live in production; if the
proxy fails, apply the direct-Function-App-URL fallback documented above before shipping.
