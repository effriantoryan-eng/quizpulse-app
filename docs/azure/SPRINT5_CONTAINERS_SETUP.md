# Sprint 5 Cosmos Containers Setup

Manual Azure Portal steps to provision the two new Cosmos DB containers Sprint 5 needs. This repo
has no Bicep/ARM/IaC for Cosmos — every existing container (`questions`, `quizzes`, `classes`,
etc.) was created the same way, by hand in the Portal, with the resulting container name wired
into `api/local.settings.json` / the Function App's Application Settings via a `COSMOS_CONTAINER_*`
env var (see CLAUDE.md's data model section).

## 1. `audit_log`

Portal → Cosmos DB account (`quizpulse-app-db-av5z18`) → **Data Explorer** → New Container:

| Setting | Value |
|---|---|
| Database | `quizpulse` (existing) |
| Container id | `audit_log` |
| Partition key | `/actorId` |
| Throughput | Serverless (same as every other container in this account) |

Used by `api/shared/auditLog.js`'s `writeAudit()` — append-only, `items.create` only. There is no
update/delete code path anywhere in this codebase for this container; do not grant any Function
identity more than create/read access if you're hand-configuring RBAC instead of using the
account key.

Env var: `COSMOS_CONTAINER_AUDIT_LOG` (fallback `'audit_log'` if unset — see `auditLog.js`).

## 2. `invites`

| Setting | Value |
|---|---|
| Database | `quizpulse` (existing) |
| Container id | `invites` |
| Partition key | `/schoolId` |
| Throughput | Serverless |

Used by `api/institutions.js` for one-time teacher-invite links (`POST
/api/manage/institutions/{id}/invite`, redeemed via `POST /api/invites/{token}/redeem`).

Env var: `COSMOS_CONTAINER_INVITES` (fallback `'invites'` if unset).

## 3. Verify

After creating both containers, set the matching `COSMOS_CONTAINER_AUDIT_LOG` /
`COSMOS_CONTAINER_INVITES` Application Settings on the deployed Function App (Portal → Function
App → Configuration), same as the other `COSMOS_CONTAINER_*` settings already there. Locally,
`api/local.settings.json` already has both set to their fallback names, so local dev works against
the emulator/account without any extra config once the containers exist.
