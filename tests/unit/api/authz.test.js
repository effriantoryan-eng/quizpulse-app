// Unit tests for api/shared/authz.js — the central authorization helper that every
// ownership/scope check in Sprint 5+ endpoints must go through.

const { getCallerScope, assertScope, requireRole, ScopeError, ROLES, READ_ALL_ROLES, MUTATE_ALL_ROLES, PRIVILEGED_ROLES } = require('../../../api/shared/authz');

describe('getCallerScope', () => {
  test('derives teacherId from the oid claim', () => {
    const scope = getCallerScope({ oid: 'teacher-123' });
    expect(scope.teacherId).toBe('teacher-123');
  });

  test('falls back to sub when oid is absent', () => {
    const scope = getCallerScope({ sub: 'teacher-456' });
    expect(scope.teacherId).toBe('teacher-456');
  });

  test('defaults role to "teacher" when no role claim is present', () => {
    const scope = getCallerScope({ oid: 't1' });
    expect(scope.role).toBe('teacher');
  });

  test('reads role from the claim when present', () => {
    const scope = getCallerScope({ oid: 't1', role: 'owner' });
    expect(scope.role).toBe('owner');
  });

  test('defaults schoolId to null when no claim is present', () => {
    const scope = getCallerScope({ oid: 't1' });
    expect(scope.schoolId).toBeNull();
  });

  test('reads schoolId from the claim when present', () => {
    const scope = getCallerScope({ oid: 't1', schoolId: 'school-A' });
    expect(scope.schoolId).toBe('school-A');
  });

  test('never reads role/schoolId from anything but the claims object passed in', () => {
    // Regression guard: getCallerScope must be a pure function of its single argument —
    // no DB lookup, no request-body fallback.
    const scope = getCallerScope({ oid: 't1' });
    expect(scope).toEqual({ teacherId: 't1', role: 'teacher', schoolId: null });
  });
});

describe('assertScope', () => {
  test('passes and returns the resource when teacherId matches', () => {
    const resource = { id: 'r1', teacherId: 'teacher-A' };
    const caller = { teacherId: 'teacher-A', role: 'teacher' };
    expect(assertScope(resource, caller)).toBe(resource);
  });

  test('throws a ScopeError when teacherId does not match', () => {
    const resource = { id: 'r1', teacherId: 'teacher-A' };
    const caller = { teacherId: 'teacher-B', role: 'teacher' };
    expect(() => assertScope(resource, caller)).toThrow(ScopeError);
  });

  test('the thrown ScopeError carries status 404, never 403', () => {
    const resource = { id: 'r1', teacherId: 'teacher-A' };
    const caller = { teacherId: 'teacher-B', role: 'teacher' };
    try {
      assertScope(resource, caller);
      throw new Error('expected assertScope to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ScopeError);
      expect(err.status).toBe(404);
    }
  });

  test('throws when the resource is missing/null', () => {
    expect(() => assertScope(null, { teacherId: 'teacher-A', role: 'teacher' })).toThrow(ScopeError);
  });

  test('throws when caller has no teacherId (fails closed)', () => {
    const resource = { id: 'r1', teacherId: 'teacher-A' };
    expect(() => assertScope(resource, { teacherId: null, role: 'teacher' })).toThrow(ScopeError);
  });

  test('school_admin scope: passes when schoolId matches via ownerField', () => {
    const resource = { id: 'r1', schoolId: 'school-X' };
    const caller = { teacherId: 't1', role: 'school_admin', schoolId: 'school-X' };
    expect(assertScope(resource, caller, { ownerField: 'schoolId' })).toBe(resource);
  });

  test('school_admin scope: throws when schoolId does not match (cross-school access)', () => {
    const resource = { id: 'r1', schoolId: 'school-Y' };
    const caller = { teacherId: 't1', role: 'school_admin', schoolId: 'school-X' };
    expect(() => assertScope(resource, caller, { ownerField: 'schoolId' })).toThrow(ScopeError);
  });

  test('school_admin scope fails closed when caller has no schoolId claim yet', () => {
    // Regression guard for the pre-claims-config state documented in
    // docs/azure/ROLE_CLAIMS_SETUP.md — a missing schoolId claim must never grant access.
    const resource = { id: 'r1', schoolId: 'school-X' };
    const caller = { teacherId: 't1', role: 'school_admin', schoolId: null };
    expect(() => assertScope(resource, caller, { ownerField: 'schoolId' })).toThrow(ScopeError);
  });

  for (const role of PRIVILEGED_ROLES) {
    test(`privileged role "${role}" bypasses the ownership check entirely`, () => {
      const resource = { id: 'r1', teacherId: 'someone-elses-id' };
      const caller = { teacherId: 'caller-id', role };
      expect(assertScope(resource, caller)).toBe(resource);
    });
  }

  test('a non-privileged role is still scoped normally', () => {
    const resource = { id: 'r1', teacherId: 'teacher-A' };
    const caller = { teacherId: 'teacher-B', role: 'teacher' };
    expect(() => assertScope(resource, caller)).toThrow(ScopeError);
  });

  for (const role of MUTATE_ALL_ROLES) {
    test(`mutate role "${role}" bypasses the ownership check when mutate: true`, () => {
      const resource = { id: 'r1', teacherId: 'someone-elses-id' };
      const caller = { teacherId: 'caller-id', role };
      expect(assertScope(resource, caller, { mutate: true })).toBe(resource);
    });
  }

  test('"support" is read-all but never bypasses a mutate check (read all, mutate none)', () => {
    expect(READ_ALL_ROLES).toContain(ROLES.SUPPORT);
    expect(MUTATE_ALL_ROLES).not.toContain(ROLES.SUPPORT);
    const resource = { id: 'r1', teacherId: 'someone-elses-id' };
    const caller = { teacherId: 'caller-id', role: ROLES.SUPPORT };
    expect(assertScope(resource, caller)).toBe(resource); // read bypass still applies
    expect(() => assertScope(resource, caller, { mutate: true })).toThrow(ScopeError); // mutate does not
  });
});

describe('requireRole', () => {
  test('passes and returns the caller when role is in the allow-list', () => {
    const caller = { teacherId: 't1', role: ROLES.OWNER };
    expect(requireRole(caller, [ROLES.OWNER])).toBe(caller);
  });

  test('throws a ScopeError (404, never 403) when role is not in the allow-list', () => {
    const caller = { teacherId: 't1', role: ROLES.TEACHER };
    expect(() => requireRole(caller, [ROLES.OWNER, ROLES.PLATFORM_ADMIN])).toThrow(ScopeError);
    try {
      requireRole(caller, [ROLES.OWNER]);
    } catch (err) {
      expect(err.status).toBe(404);
    }
  });

  test('throws when caller is missing entirely (fails closed)', () => {
    expect(() => requireRole(null, [ROLES.OWNER])).toThrow(ScopeError);
  });
});
