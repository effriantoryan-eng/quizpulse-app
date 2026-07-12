// Local-only dev auth bypass — skips the real Entra login for manual/automated testing.
// Active ONLY when both are true: Vite dev build (import.meta.env.DEV) AND
// VITE_DEV_AUTH_BYPASS=true in .env.local. Never present in a production build.
// Requires api/local.settings.json's B2C_ALLOW_UNVERIFIED_DEV=true so the API accepts the
// unsigned token below (see api/auth.js DEV_MODE).
export const DEV_AUTH_BYPASS = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

const claims = { oid: 'dev-teacher-001', name: 'Dev Teacher', email: 'dev@localhost' }

// Unsigned JWT (header.payload.'sig') — fine because DEV_MODE decodes without verifying.
const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const DEV_AUTH_TOKEN = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url(claims)}.dev`

export const devAuthUser = {
  teacherId: claims.oid,
  user: { name: claims.name, email: claims.email, idp: 'dev' },
  isAuthenticated: true,
  loading: false,
  login: () => {},
  logout: () => { window.location.reload() },
}
