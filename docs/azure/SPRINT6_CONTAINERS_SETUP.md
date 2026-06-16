# Sprint 6 — New Cosmos DB Containers

Two new containers are required for the community question bank. Create them manually before
deploying the Sprint 6 API.

---

## Container 1 — `question_upvotes`

Stores one document per teacher-question upvote pair (toggle: creating = upvote on, deleting = off).

| Property | Value |
|---|---|
| Container id | `question_upvotes` |
| Partition key | `/questionId` |
| Throughput | Serverless (same as other containers) |

### Portal steps

1. Azure Portal → **Cosmos DB** → `quizpulse-app-db-av5z18` → **Data Explorer**
2. Click **New Container**
3. Database id: select existing → `quizpulse-app-db`
4. Container id: `question_upvotes`
5. Partition key: `/questionId`
6. Throughput: **Serverless** (no manual RU provisioning)
7. Click **OK**

### Function App config

Add to Function App application settings (`quizpulse-app-api-av5z18` → Settings → Environment variables):

```
COSMOS_CONTAINER_QUESTION_UPVOTES = question_upvotes
```

---

## Container 2 — `question_reports`

Stores moderation reports submitted by teachers against public/school questions.

| Property | Value |
|---|---|
| Container id | `question_reports` |
| Partition key | `/questionId` |
| Throughput | Serverless |

### Portal steps

Same as above, but:
- Container id: `question_reports`
- Partition key: `/questionId`

### Function App config

```
COSMOS_CONTAINER_QUESTION_REPORTS = question_reports
```

---

## Verification

After provisioning, restart the Function App and smoke-test:

```bash
# Should return 200 [] (empty array — no upvotes yet)
curl -H "Authorization: Bearer <token>" \
  https://quizpulse-app-api-av5z18.azurewebsites.net/api/questions/<any-question-id>/upvote \
  -X POST

# Should return 201 { reported: true }
curl -H "Authorization: Bearer <token>" \
  https://quizpulse-app-api-av5z18.azurewebsites.net/api/questions/<public-question-id>/report \
  -X POST -H "Content-Type: application/json" -d '{"reason":"test"}'
```

If either returns 500, check that both env vars are set and the containers exist with the correct
partition keys.

---

## local.settings.json update (for local dev)

Add both keys to `api/local.settings.json` under `Values`:

```json
"COSMOS_CONTAINER_QUESTION_UPVOTES": "question_upvotes",
"COSMOS_CONTAINER_QUESTION_REPORTS": "question_reports"
```

The Cosmos emulator does not support sub-partition containers out of the box; run the real
Azure Cosmos account for integration testing of upvote/report functionality.
