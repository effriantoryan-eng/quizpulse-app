// Step-up re-authentication guard for owner-gated destructive actions (Sprint 5 — school merge;
// reused as-is by any future destructive admin endpoint, e.g. Sprint 6/7's monitoring UI).
//
// Verified off the signed `auth_time` claim (falls back to `iat` if Entra doesn't emit auth_time
// for a given flow) — never a client-supplied timestamp/header, since that would let a caller
// just assert they recently re-authenticated.

const STEP_UP_WINDOW_MS = 10 * 60 * 1000; // Security limits table — 10 min since last sign-in

class StepUpError extends Error {
  constructor(message = 'Re-authentication required') {
    super(message);
    this.status = 401;
    this.reauthRequired = true;
  }
}

// Throws a StepUpError unless `claims` carries a signed auth_time/iat within the step-up window.
function assertStepUp(claims) {
  const signedAt = claims?.auth_time || claims?.iat;
  if (!signedAt || (Date.now() - signedAt * 1000) > STEP_UP_WINDOW_MS) {
    throw new StepUpError();
  }
}

module.exports = { assertStepUp, StepUpError, STEP_UP_WINDOW_MS };
