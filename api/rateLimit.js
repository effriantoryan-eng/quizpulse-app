// Rate limiting is enforced at the Azure API Management layer (see docs/azure/APIM_SETUP.md).
// This module is a no-op kept so call sites compile without changes — the sliding-window
// in-memory store has been removed. APIM policies cover every limit from the security table.
//
// The only exception is the school-merge serialisation lock in schoolAdmin.js, which uses
// a module-level boolean rather than this helper because it is a concurrency control
// (exactly 1 in-flight merge), not a throughput limit.

/**
 * Always returns true — APIM enforces the actual limit before the request reaches here.
 * @returns {boolean}
 */
function rateLimit() {
  return true;
}

/**
 * Extracts the real client IP from the x-forwarded-for header.
 * Still needed for audit log ip fields in institutions.js and schoolAdmin.js.
 * @param {Request} request
 * @returns {string}
 */
function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

module.exports = { rateLimit, getClientIp };
