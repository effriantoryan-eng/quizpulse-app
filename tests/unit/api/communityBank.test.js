// Unit tests for Sprint 6 community question bank logic.
// Tests visibility scoping rules and upvote idempotency without hitting real Cosmos.

const { getCallerScope, assertScope, requireRole, ScopeError, ROLES, MUTATE_ALL_ROLES, READ_ALL_ROLES } = require('../../../api/shared/authz');

// ── Visibility scoping ──────────────────────────────────────────────────────

describe('visibility scoping — assertScope', () => {
  const teacher = { teacherId: 'teacher-A', role: ROLES.TEACHER, schoolId: null };

  test('teacher can read their own private question', () => {
    const q = { teacherId: 'teacher-A', visibility: 'private' };
    expect(() => assertScope(q, teacher)).not.toThrow();
  });

  test('teacher cannot read another teacher\'s private question', () => {
    const q = { teacherId: 'teacher-B', visibility: 'private' };
    expect(() => assertScope(q, teacher)).toThrow(ScopeError);
  });

  test('teacher can mutate their own school-visible question', () => {
    const q = { teacherId: 'teacher-A', visibility: 'school' };
    expect(() => assertScope(q, teacher, { mutate: true })).not.toThrow();
  });

  test('teacher cannot mutate another teacher\'s school-visible question', () => {
    const q = { teacherId: 'teacher-B', visibility: 'school' };
    expect(() => assertScope(q, teacher, { mutate: true })).toThrow(ScopeError);
  });

  test('platform_admin can read any question regardless of visibility', () => {
    const admin = { teacherId: 'admin-1', role: ROLES.PLATFORM_ADMIN, schoolId: null };
    const q = { teacherId: 'teacher-B', visibility: 'private' };
    expect(() => assertScope(q, admin)).not.toThrow();
  });

  test('platform_admin can mutate any question (e.g. unpublish via visibility=private)', () => {
    const admin = { teacherId: 'admin-1', role: ROLES.PLATFORM_ADMIN, schoolId: null };
    const q = { teacherId: 'teacher-B', visibility: 'public' };
    expect(() => assertScope(q, admin, { mutate: true })).not.toThrow();
  });

  test('support can read any question but cannot mutate', () => {
    const support = { teacherId: 'support-1', role: ROLES.SUPPORT, schoolId: null };
    const q = { teacherId: 'teacher-B', visibility: 'private' };
    expect(() => assertScope(q, support)).not.toThrow();
    expect(() => assertScope(q, support, { mutate: true })).toThrow(ScopeError);
  });

  test('owner can read and mutate any question', () => {
    const owner = { teacherId: 'owner-1', role: ROLES.OWNER, schoolId: null };
    const q = { teacherId: 'teacher-B', visibility: 'private' };
    expect(() => assertScope(q, owner)).not.toThrow();
    expect(() => assertScope(q, owner, { mutate: true })).not.toThrow();
  });
});

// ── Moderation report queue — requireRole gating ────────────────────────────

describe('report queue — role gating', () => {
  test('support can access the report queue', () => {
    const caller = { teacherId: 't1', role: ROLES.SUPPORT };
    expect(() => requireRole(caller, [ROLES.SUPPORT, ROLES.PLATFORM_ADMIN, ROLES.OWNER])).not.toThrow();
  });

  test('platform_admin can access the report queue', () => {
    const caller = { teacherId: 't1', role: ROLES.PLATFORM_ADMIN };
    expect(() => requireRole(caller, [ROLES.SUPPORT, ROLES.PLATFORM_ADMIN, ROLES.OWNER])).not.toThrow();
  });

  test('plain teacher cannot access the report queue', () => {
    const caller = { teacherId: 't1', role: ROLES.TEACHER };
    expect(() => requireRole(caller, [ROLES.SUPPORT, ROLES.PLATFORM_ADMIN, ROLES.OWNER])).toThrow(ScopeError);
  });
});

// ── Upvote idempotency logic ─────────────────────────────────────────────────

describe('upvote idempotency', () => {
  function simulateUpvoteToggle(existing, currentCount) {
    if (existing) {
      // removing
      return { upvoted: false, upvoteCount: Math.max(0, currentCount - 1) };
    } else {
      // adding
      return { upvoted: true, upvoteCount: currentCount + 1 };
    }
  }

  test('first upvote increments count and sets upvoted=true', () => {
    const result = simulateUpvoteToggle(false, 0);
    expect(result).toEqual({ upvoted: true, upvoteCount: 1 });
  });

  test('second upvote (toggle off) decrements count and sets upvoted=false', () => {
    const result = simulateUpvoteToggle(true, 1);
    expect(result).toEqual({ upvoted: false, upvoteCount: 0 });
  });

  test('count never goes below 0 on remove', () => {
    const result = simulateUpvoteToggle(true, 0);
    expect(result.upvoteCount).toBe(0);
  });

  test('upvoteCount increments from a higher base', () => {
    const result = simulateUpvoteToggle(false, 47);
    expect(result).toEqual({ upvoted: true, upvoteCount: 48 });
  });
});

// ── Visibility transition rules ──────────────────────────────────────────────

describe('visibility transitions', () => {
  const ALLOWED = ['private', 'school', 'public'];

  test('all three visibility values are valid', () => {
    expect(ALLOWED).toContain('private');
    expect(ALLOWED).toContain('school');
    expect(ALLOWED).toContain('public');
  });

  test('unknown visibility values are rejected', () => {
    const invalid = ['shared', 'org', 'protected', '', '   '];
    invalid.forEach(v => {
      expect(ALLOWED.includes(v)).toBe(false);
    });
  });

  test('MUTATE_ALL_ROLES includes platform_admin but not support', () => {
    expect(MUTATE_ALL_ROLES).toContain(ROLES.PLATFORM_ADMIN);
    expect(MUTATE_ALL_ROLES).toContain(ROLES.OWNER);
    expect(MUTATE_ALL_ROLES).not.toContain(ROLES.SUPPORT);
  });

  test('READ_ALL_ROLES includes support', () => {
    expect(READ_ALL_ROLES).toContain(ROLES.SUPPORT);
  });
});

// ── yearLevel validation ─────────────────────────────────────────────────────

describe('yearLevel validation', () => {
  function validateYearLevel(v) {
    if (v === undefined || v === null) return true;
    return typeof v === 'number' && Number.isInteger(v) && v >= 7 && v <= 12;
  }

  test('null is valid (no year restriction)', () => { expect(validateYearLevel(null)).toBe(true); });
  test('undefined is valid (not provided)', () => { expect(validateYearLevel(undefined)).toBe(true); });
  test('7 is valid', () => { expect(validateYearLevel(7)).toBe(true); });
  test('12 is valid', () => { expect(validateYearLevel(12)).toBe(true); });
  test('6 is invalid', () => { expect(validateYearLevel(6)).toBe(false); });
  test('13 is invalid', () => { expect(validateYearLevel(13)).toBe(false); });
  test('string "9" is invalid', () => { expect(validateYearLevel('9')).toBe(false); });
  test('float 9.5 is invalid', () => { expect(validateYearLevel(9.5)).toBe(false); });
});
