// Microsoft Entra External ID (CIAM) JWT validation for the QuizPulse API.
// Replaces Azure AD B2C, retired for new tenants in May 2025.
//
// Teacher/admin endpoints validate the bearer token (an ID token from Entra External ID)
// and derive teacherId from the `oid` claim. The token is never trusted from the client body.
//
// In production: verified against the CIAM JWKS endpoint (signature, issuer, audience, expiry).
// For local development and integration tests: set AUTH_ALLOW_UNVERIFIED_DEV=true to decode
// without signature verification so tests can mint their own tokens. Never set in production.

const jwt = require('jsonwebtoken');
const { JwksClient } = require('jwks-rsa');

const TENANT_SUBDOMAIN = process.env.AUTH_TENANT_SUBDOMAIN;
const TENANT_ID = process.env.AUTH_TENANT_ID;
const AUDIENCE = process.env.AUTH_CLIENT_ID;
const DEV_MODE = process.env.B2C_ALLOW_UNVERIFIED_DEV === 'true';

// Entra External ID CIAM issuer and JWKS — no policy name in the URL.
const ISSUER = TENANT_ID
  ? `https://${TENANT_SUBDOMAIN}.ciamlogin.com/${TENANT_ID}/v2.0`
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

// Verifies a raw JWT string and resolves with its claims, or rejects.
function verifyToken(token) {
  if (DEV_MODE) {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object') {
      return Promise.reject(new Error('Token could not be decoded'));
    }
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return Promise.reject(new Error('Token expired'));
    }
    return Promise.resolve(decoded);
  }

  if (!ISSUER || !AUDIENCE || !JWKS_URI) {
    return Promise.reject(new Error('Entra External ID not configured (AUTH_TENANT_SUBDOMAIN / AUTH_TENANT_ID / AUTH_CLIENT_ID)'));
  }

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getSigningKey,
      { audience: AUDIENCE, issuer: ISSUER, algorithms: ['RS256'] },
      (err, claims) => (err ? reject(err) : resolve(claims))
    );
  });
}

// Authenticates a teacher request. Returns { teacherId, claims } on success or
// { error, status } describing the failure. Handlers should respond 401 on failure.
async function authenticateTeacher(request) {
  const token = extractBearer(request);
  if (!token) {
    return { error: 'Authentication required', status: 401 };
  }
  try {
    const claims = await verifyToken(token);
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
  verifyToken,
  teacherIdFromClaims,
  extractBearer,
  // exported for tests
  _config: { DEV_MODE, ISSUER, AUDIENCE, JWKS_URI },
};
