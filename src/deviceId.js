// The one place that reads/creates the student device identity. Before R3 there were four copies
// of a get-or-create generator (src/session.js getSessionId, and getOrCreateDeviceId in
// JoinClass/TakeQuiz, getDeviceId in StudentClass) — every one of them minted on read, which is
// exactly what R3 stops: a permanent ID must NOT exist until a student actually submits the join
// form (audit B2 — no tracking before notice).
//
// getDeviceId() is read-only and returns null when there's no ID yet. createDeviceId() is the ONLY
// thing that mints, and it's called from exactly one place: JoinClass's submit handler.

const DEVICE_ID_KEY = 'quizpulse_device_id'

// Read the existing device ID, or null if this device has never joined a class. Never mints.
export function getDeviceId() {
  try {
    return localStorage.getItem(DEVICE_ID_KEY) || null
  } catch {
    return null
  }
}

// Mint and store the device ID (idempotent — returns the existing one if already present). Call
// this ONLY at the moment of joining (JoinClass submit). Returns the id, or a fresh un-stored
// UUID if storage is blocked, so the in-flight join request still carries a stable id.
export function createDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}
