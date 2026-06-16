// Central authorization helper for QuizPulse API handlers.
//
// Every endpoint that accepts a resource ID (classId, quizId, questionId, requestId, ...)
// MUST call assertScope before reading or mutating that resource. This is the single place
// where "does this caller own/see this resource" is decided, so the rule stays consistent
// across endpoints instead of being hand-rolled (and drifting) in each handler.

const ROLES = { TEACHER: 'teacher', SUPPORT: 'support', PLATFORM_ADMIN: 'platform_admin', OWNER: 'owner' };

// Role tiers for cross-tenant access. 'support' is read-only by design (it bypasses ownership
// checks on reads but never on mutations); 'platform_admin' may perform operational mutations
// (institution onboarding, school validation) but not destructive ones (school merge, role
// changes — those require requireRole([ROLES.OWNER]) explicitly at the call site); 'owner' does
// both. Kept for backwards compatibility with any code still checking the old read-only list.
const READ_ALL_ROLES = [ROLES.OWNER, ROLES.SUPPORT, ROLES.PLATFORM_ADMIN];
const MUTATE_ALL_ROLES = [ROLES.OWNER, ROLES.PLATFORM_ADMIN];
const PRIVILEGED_ROLES = READ_ALL_ROLES;

// Thrown by assertScope on a scope mismatch. Handlers should catch this and respond 404 —
// never 403. Returning 403 would confirm to the caller that the resource exists but isn't
// theirs; 404 reveals nothing about resources outside their scope.
class ScopeError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.status = 404;
  }
}

// Derives the caller's authorization scope from validated JWT claims ONLY — never from a
// request body or a database read. `claims` must already have passed signature/issuer/
// audience/expiry verification (see api/auth.js).
//
// `role` is read from a custom claim that Entra External ID emits once configured per
// docs/azure/ROLE_CLAIMS_SETUP.md. Until that configuration is in place, the claim is absent
// and every caller scopes as a plain 'teacher' — a missing claim never grants extra access.
function getCallerScope(claims) {
  const teacherId = claims.oid || claims.sub || null;
  const role = typeof claims.role === 'string' && claims.role ? claims.role : 'teacher';
  const schoolId = typeof claims.schoolId === 'string' && claims.schoolId ? claims.schoolId : null;
  return { teacherId, role, schoolId };
}

// Throws a ScopeError (404-equivalent) when `resource` does not belong to `caller`'s scope.
// Returns `resource` unchanged when the check passes, so call sites can chain it:
//   const cls = assertScope(existing, caller);
//
// - Pass `{ mutate: true }` for any write (PUT/DELETE/POST-that-mutates). Reads bypass via
//   READ_ALL_ROLES (owner/support/platform_admin); mutations bypass via the narrower
//   MUTATE_ALL_ROLES (owner/platform_admin only) — 'support' can never mutate through this
//   helper, by design.
// - Otherwise resource[ownerField] must equal the caller's matching scope value:
//   ownerField 'teacherId' (default) compares against caller.teacherId (a teacher's own data);
//   ownerField 'schoolId' compares against caller.schoolId (school_admin's school-wide reads).
function assertScope(resource, caller, { ownerField = 'teacherId', mutate = false } = {}) {
  if (!resource) throw new ScopeError();
  const bypassRoles = mutate ? MUTATE_ALL_ROLES : READ_ALL_ROLES;
  if (caller && bypassRoles.includes(caller.role)) return resource;

  const expected = ownerField === 'schoolId' ? caller?.schoolId : caller?.teacherId;
  if (!expected || resource[ownerField] !== expected) {
    throw new ScopeError();
  }
  return resource;
}

// Throws a ScopeError (404-equivalent) unless caller.role is one of `allowedRoles`. For admin
// endpoints that gate on role alone — there's no caller-owned resource to check ownership
// against (e.g. "create an institution", "view platform metrics").
function requireRole(caller, allowedRoles) {
  if (!caller || !allowedRoles.includes(caller.role)) {
    throw new ScopeError();
  }
  return caller;
}

module.exports = {
  getCallerScope,
  assertScope,
  requireRole,
  ScopeError,
  ROLES,
  READ_ALL_ROLES,
  MUTATE_ALL_ROLES,
  PRIVILEGED_ROLES,
};
