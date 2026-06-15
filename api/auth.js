// Azure AD B2C JWT validation for the QuizPulse API.
//
// Teacher/admin endpoints must derive the teacher identity from a validated B2C access token
// rather than trusting a client-supplied teacherId. This replaces the previous model where
// teacherId was just a localStorage UUID passed in the query string / body.
//
// In production: the bearer token is verified against the B2C JWKS (signature, issuer,
// audience, expiry) and teacherId is taken from the `oid` (or `sub`) claim.
//
// For local development and integration tests (no live tenant), set
// B2C_ALLOW_UNVERIFIED_DEV=true. The token is then DECODED but not signature-verified, so
// tests can mint their own tokens. This flag must never be set in production.

const jwt = require('jsonwebtoken');
const { JwksClient } = require('jwks-rsa');

const TENANT_NAME = process.env.B2C_TENANT_NAME;
const TENANT_ID = process.env.B2C_TENANT_ID;
const POLICY = process.env.B2C_POLICY || 'B2C_1_signupsignin';
const AUDIENCE = process.env.B2C_CLIENT_ID;
const DEV_MODE = process.env.B2C_ALLOW_UNVERIFIED_DEV === 'true';

// B2C v2 issuer is keyed by tenant id; JWKS lives under the user-flow discovery endpoint.
const ISSUER = TENANT_ID
  ? `https://${TENANT_NAME}.b2clogin.com/${TENANT_ID}/v2.0/`
  : null;
const JWKS_URI = TENANT_NAME
  ? `https://${TENANT_NAME}.b2clogin.com/${TENANT_NAME}.onmicrosoft.com/${POLICY}/discovery/v2.0/keys`
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
    return Promise.reject(new Error('B2C is not configured (B2C_TENANT_NAME / B2C_TENANT_ID / B2C_CLIENT_ID)'));
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
