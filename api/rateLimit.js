// In-memory sliding window rate limiter.
// State is per Function instance — not shared across scale-out replicas.
// Sufficient for MVP; replace with Azure API Management for production scale.

const store = new Map()

/**
 * Returns true if the request is allowed, false if rate limited.
 * @param {string} key       - Unique key (e.g. "questions:1.2.3.4")
 * @param {number} max       - Maximum requests allowed in the window
 * @param {number} windowMs  - Window size in milliseconds
 */
function rateLimit(key, max, windowMs) {
  const now = Date.now()
  const timestamps = (store.get(key) || []).filter(t => now - t < windowMs)

  if (timestamps.length >= max) {
    return false
  }

  timestamps.push(now)
  store.set(key, timestamps)

  // Periodically prune stale keys to prevent unbounded memory growth
  if (store.size > 10000) {
    for (const [k, ts] of store.entries()) {
      if (ts.every(t => now - t >= windowMs)) store.delete(k)
    }
  }

  return true
}

/**
 * Extracts the client IP from the request headers.
 * Azure passes the real IP in x-forwarded-for.
 */
function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}

module.exports = { rateLimit, getClientIp }
