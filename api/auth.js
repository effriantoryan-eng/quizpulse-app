// Microsoft Entra External ID (CIAM) JWT validation for the QuizPulse API.
// Replaces Azure AD B2C, retired for new tenants in May 2025.
//
// Two audiences are supported:
//   AUTH_CLIENT_ID       — teacher app (used by authenticateTeacher, all teacher-facing endpoints)
//   ADMIN_AUTH_CLIENT_ID — admin portal (used by authenticateAdmin, all /api/manage/* endpoints)
//
// In production: verified against the CIAM JWKS endpoint (signature, issuer, audience, expiry).
// In DEV_MODE: decoded without signature verification; audience checked when the token carries an
// `aud` claim AND the matching env var is configured — backward-compatible with existing test
// tokens that have no `aud` claim.

const jwt = require('jsonwebtoken');
const { JwksClient } = require('jwks-rsa');

const TENANT_SUBDOMAIN = process.env.AUTH_TENANT_SUBDOMAIN;
const TENANT_ID = process.env.AUTH_TENANT_ID;
const AUDIENCE = process.env.AUTH_CLIENT_ID;
const ADMIN_AUDIENCE = process.env.ADMIN_AUTH_CLIENT_ID;
const DEV_MODE = process.env.B2C_ALLOW_UNVERIFIED_DEV === 'true';

// Entra External ID CIAM issuer and JWKS — no policy name in the URL.
// CIAM stamps the token `iss` with the tenant GUID host ({tenantId}.ciamlogin.com) even when the
// app authenticates via the subdomain host ({subdomain}.ciamlogin.com). Accept BOTH forms so
// real production verification succeeds regardless of which host MSAL/CIAM uses. jwt.verify takes
// an array for `issuer` and passes if the token's iss matches any entry.
const ISSUER = TENANT_ID
  ? [
      `https://${TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_ID}/v2.0`,
      `https://${TENANT_ID}.ciamlogin.com/${TENANT_ID}/v2.0`,
    ]
  : null;
const JWKS_URI = TENANT_ID
  ? `https://${TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_ID}/discovery/v2.0/keys`
  : null;

let jwks;
function getJwksClient() {
  if (!jwks) {
    jwks = new JwksClient({ jwksUri: JWKS_URI, cache: true, cacheMaxAge: 24 * 60 * 60 * 1000, rateLimit: true });
  }
  return jwks;
}

function getSigningKey(header, callback) {
  getJwksClient().getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

function extractBearer(request) {
  const authz = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authz.trim());
  return match ? match[1] : null;
}

function teacherIdFromClaims(claims) {
  return claims.oid || claims.sub || null;
}

// Verifies a raw JWT string against a specific audience and resolves with its claims, or rejects.
// In DEV_MODE, signature is not checked; audience is checked only when both the token carries an
// `aud` claim and `expectedAudience` is provided — this keeps existing no-aud tests working while
// allowing new audience-separation tests to assert rejection correctly.
function verifyTokenForAudience(token, expectedAudience) {
  if (DEV_MODE) {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object') {
      return Promise.reject(new Error('Token could not be decoded'));
    }
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return Promise.reject(new Error('Token expired'));
    }
    if (expectedAudience && decoded.aud && decoded.aud !== expectedAudience) {
      return Promise.reject(new Error(`Token audience mismatch: expected ${expectedAudience}, got ${decoded.aud}`));
    }
    return Promise.resolve(decoded);
  }

  if (!ISSUER || !expectedAudience || !JWKS_URI) {
    return Promise.reject(new Error('Entra External ID not configured'));
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      { audience: expectedAudience, issuer: ISSUER, algorithms: ['RS256'] },
      (err, claims) => (err ? reject(err) : resolve(claims))
    );
  });
}

// Verifies a raw JWT string against the teacher app audience (AUTH_CLIENT_ID).
// Kept for backward compatibility — existing code that imports verifyToken directly continues
// to work unchanged.
function verifyToken(token) {
  return verifyTokenForAudience(token, AUDIENCE);
}

// Authenticates a teacher request (teacher app audience). Returns { teacherId, claims } on
// success or { error, status } on failure. Handlers should respond 401 on failure.
async function authenticateTeacher(request) {
  const token = extractBearer(request);
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }
  try {
    const claims = await verifyTokenForAudience(token, AUDIENCE);
    const teacherId = teacherIdFromClaims(claims);
    if (!teacherId) {
      return { error: 'Token is missing a subject claim', status: 401 };
    }
    return { teacherId, claims };
  } catch (err) {
    return { error: 'Invalid or expired token', status: 401, detail: err.message };
  }
}

// Authenticates an admin portal request (admin CIAM app audience — ADMIN_AUTH_CLIENT_ID).
// Used by all /api/manage/* endpoints. A teacher-app token is rejected here (audience mismatch),
// and an admin token is rejected by authenticateTeacher (same reason), keeping the portals
// cleanly separated.
async function authenticateAdmin(request) {
  const token = extractBearer(request);
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }
  if (!ADMIN_AUDIENCE && !DEV_MODE) {
    return { error: 'Admin authentication not configured', status: 500 };
  }
  try {
    const claims = await verifyTokenForAudience(token, ADMIN_AUDIENCE);
    const teacherId = teacherIdFromClaims(claims);
    if (!teacherId) {
      return { error: 'Token is missing a subject claim', status: 401 };
    }
    return { teacherId, claims };
  } catch (err) {
    return { error: 'Invalid or expired token', status: 401, detail: err.message };
  }
}

module.exports = {
  authenticateTeacher,
  authenticateAdmin,
  verifyToken,
  verifyTokenForAudience,
  teacherIdFromClaims,
  extractBearer,
  // exported for tests
  _config: { DEV_MODE, ISSUER, AUDIENCE, ADMIN_AUDIENCE, JWKS_URI },
};
