// Unit tests for api/shared/auditLog.js — the append-only audit trail every admin mutation
// must write to. Mirrors writeAudit()'s logic against a fake container, same pattern as
// tests/unit/api/responses.test.js and analytics.test.js (this repo's unit tests don't import
// api/*.js modules directly since they construct a real CosmosClient against env vars that
// aren't set in the jest environment, and @azure/cosmos isn't hoisted to the root node_modules
// jest resolves against).

const fs = require('fs');
const path = require('path');

function makeWriteAudit(container) {
  return async function writeAudit({ actorId, actorRole, action, targetType, targetId, before = null, after = null, ip = null }) {
    const entry = {
      id: 'generated-id',
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
    const { resource } = await container.items.create(entry);
    return resource;
  };
}

describe('writeAudit', () => {
  test('writes an entry with an id and createdAt timestamp', async () => {
    const created = [];
    const container = { items: { create: async (doc) => { created.push(doc); return { resource: doc }; } } };
    const writeAudit = makeWriteAudit(container);

    const result = await writeAudit({
      actorId: 'owner-1',
      actorRole: 'owner',
      action: 'school.validate',
      targetType: 'school',
      targetId: 'school-1',
      before: { status: 'unvalidated' },
      after: { status: 'validated' },
      ip: '127.0.0.1',
    });

    expect(created).toHaveLength(1);
    expect(created[0].id).toBeTruthy();
    expect(created[0].createdAt).toBeTruthy();
    expect(created[0].actorId).toBe('owner-1');
    expect(created[0].before).toEqual({ status: 'unvalidated' });
    expect(created[0].after).toEqual({ status: 'validated' });
    expect(result).toEqual(created[0]);
  });

  test('defaults before/after/ip to null when not provided', async () => {
    const created = [];
    const container = { items: { create: async (doc) => { created.push(doc); return { resource: doc }; } } };
    const writeAudit = makeWriteAudit(container);

    await writeAudit({ actorId: 'owner-1', actorRole: 'owner', action: 'noop', targetType: 'school', targetId: 's1' });
    expect(created[0].before).toBeNull();
    expect(created[0].after).toBeNull();
    expect(created[0].ip).toBeNull();
  });
});

describe('audit_log append-only guarantee', () => {
  test('api/shared/auditLog.js exports only writeAudit — no update/delete/replace function', () => {
    // Static source check rather than `require`, since the real module constructs a CosmosClient
    // from env vars not set in this test environment. Regression guard: there must be no
    // reachable code path that mutates or removes an existing audit entry.
    const source = fs.readFileSync(path.join(__dirname, '../../../api/shared/auditLog.js'), 'utf8');
    const exportsLine = source.match(/module\.exports\s*=\s*\{([^}]*)\}/)[1];
    const exportedNames = exportsLine.split(',').map(s => s.trim()).filter(Boolean);
    expect(exportedNames).toEqual(['writeAudit']);
    expect(source).not.toMatch(/\.replace\(|\.delete\(|\.upsert\(/);
  });
});
