// In-memory sliding-window rate limiter (per Function App instance).
// Sufficient for pilot scale. APIM rate-limit-by-key requires Developer tier or higher —
// not available on Consumption — so per-instance enforcement is used instead.

const _store = new Map();

/**
 * Returns true if the caller is within the allowed rate, false if they should be throttled.
 * @param {string} key   - unique key per caller+endpoint (e.g. "analytics:1.2.3.4")
 * @param {number} max   - max calls allowed in the window
 * @param {number} windowMs - window length in milliseconds
 * @returns {boolean}
 */
function rateLimit(key, max, windowMs) {
  // ponytail: Jest integration tests fire many requests from one process/IP and trip this
  // shared-across-callers limiter on throttle, not on real bugs. Bypass only under
  // RUN_INTEGRATION=true (the same env var that already gates the integration suite itself —
  // see CLAUDE.md Testing), so it can never be flipped on in production by accident.
  if (process.env.RUN_INTEGRATION === 'true') return true;
  const now = Date.now();
  const timestamps = (_store.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= max) return false;
  timestamps.push(now);
  _store.set(key, timestamps);
  return true;
}

/**
 * Extracts the real client IP from the x-forwarded-for header.
 * @param {Request} request
 * @returns {string}
 */
function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown';
}

module.exports = { rateLimit, getClientIp };
