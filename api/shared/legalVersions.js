// Server-side mirror of ONLY the legal version constants — never the text. The server validates
// that a client sent the current version; it never renders or stores wording. Same client/server
// duplication convention as apstContent.js and topicTags.js (see CLAUDE.md).
//
// Bump a version constant whenever the corresponding document's wording materially changes, so
// existing teachers re-accept (termsCurrent → false) and new join requests must carry the new
// notice version.

const TERMS_VERSION = '2026-09-18';
const COLLECTION_NOTICE_VERSION = '2026-09-18';
const ATTESTATION_VERSION = '2026-09-18';

// D3.4 attestation cut-off. Before this instant, joins to an un-attested real class are still
// accepted (grace period for classes created before attestation existed); after it, they 409 with
// "Your teacher needs to finish setting up this class." The reviewer sets the calendar date;
// process.env.ATTESTATION_REQUIRED_FROM overrides it so integration tests can move it into the
// past. Left null here because no reviewer date was supplied — see attestationCutoffMs().
const ATTESTATION_REQUIRED_FROM = null;

// Resolves the cut-off to a millisecond timestamp. CRITICAL (CEO review): this must FAIL OPEN.
// An unset/blank/invalid value returns Infinity (never blocks a join), NOT 0 — a bare
// `Date.now() >= null` coerces to `now >= 0` → true, which would take every legacy pilot class
// offline the moment R3 deploys. So: no date configured ⇒ nobody is ever blocked by the cut-off.
// Only a real, parseable date ever starts blocking un-attested joins.
function attestationCutoffMs() {
  const raw = process.env.ATTESTATION_REQUIRED_FROM || ATTESTATION_REQUIRED_FROM;
  if (!raw) return Infinity;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? Infinity : ms;
}

// True when an un-attested real class should now reject joins: a cut-off is configured AND we are
// past it. `now` is injectable for tests.
function attestationRequiredNow(now = Date.now()) {
  return now >= attestationCutoffMs();
}

// Pure version-equality check (eng review 8). Returns one of:
//   'absent'  — the client sent no version (old cached client, D3.7)
//   'stale'   — sent a version that isn't the current one
//   'current' — sent the current version
// It does NOT decide whether 'absent' is an error — each call site does: join-notice and onboarding
// treat absent as "store null" (tolerant), while PUT /api/me/terms and attestation reject absent.
function versionState(provided, current) {
  if (provided === undefined || provided === null || provided === '') return 'absent';
  return provided === current ? 'current' : 'stale';
}

module.exports = {
  TERMS_VERSION,
  COLLECTION_NOTICE_VERSION,
  ATTESTATION_VERSION,
  ATTESTATION_REQUIRED_FROM,
  attestationCutoffMs,
  attestationRequiredNow,
  versionState,
};
