// Append-only audit trail for admin/institution mutations (Sprint 5). Every endpoint built on
// top of requireRole() in api/shared/authz.js that mutates cross-tenant state — school validate,
// school merge, institution onboarding, invites — must call writeAudit() once the mutation
// succeeds. There is deliberately no update/delete export here: a function that doesn't exist
// can't accidentally be called to tamper with the trail.
//
// Container: audit_log (COSMOS_CONTAINER_AUDIT_LOG env, fallback 'audit_log'), partition key
// /actorId. Manual provisioning steps: docs/azure/SPRINT5_CONTAINERS_SETUP.md.

const { CosmosClient } = require('@azure/cosmos');

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});
const database = client.database(process.env.COSMOS_DATABASE);
const auditLogContainer = database.container(process.env.COSMOS_CONTAINER_AUDIT_LOG || 'audit_log');

// Writes one audit entry. `before`/`after` are plain snapshots (or summaries) of the affected
// state — pass whatever's useful for reconstructing what happened, there's no fixed shape.
async function writeAudit({ actorId, actorRole, action, targetType, targetId, before = null, after = null, ip = null }) {
  const entry = {
    id: require('crypto').randomUUID(),
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    before,
    after,
    ip,
    createdAt: new Date().toISOString(),
  };
  const { resource } = await auditLogContainer.items.create(entry);
  return resource;
}

module.exports = { writeAudit };
