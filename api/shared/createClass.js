// Single place that creates a real (non-demo) class document — join code, schoolId
// denormalisation, and the 20-real-class cap all live here so callers (api/classes.js's
// POST handler, and the v4.2.0 onboarding-wizard class-shell creation) can never drift apart.
// This codebase has already been bitten once by copy-pasted logic diverging across call sites
// (the rateLimit-import regression) — see CLAUDE.md's Authorization model note.
const crypto = require('crypto');
const { ATTESTATION_VERSION, versionState } = require('./legalVersions');

const CLASS_NAME_MAX = 80;      // Security limits table — Class name length
const CLASSES_PER_TEACHER = 20; // Security limits table — Classes per teacher (real classes only)

class ClassLimitError extends Error {
  constructor(message = `You can have at most ${CLASSES_PER_TEACHER} classes.`) {
    super(message);
    this.status = 429;
  }
}

// R3 Task 6 — thrown when a real class is created without a valid school-authorisation
// attestation. Callers map this to 400.
class AttestationError extends Error {
  constructor(message = 'Please confirm your school has authorised QuizPulse before creating a class.') {
    super(message);
    this.status = 400;
  }
}

// 8-char alphanumeric join code, excluding visually ambiguous characters (0/O, 1/I/L).
function generateJoinCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// Creates one real class for `teacherId`. Throws ClassLimitError (429) if the teacher is
// already at the 20-real-class cap — callers doing a sequential batch (onboarding shells)
// should let that propagate and stop, rather than pre-computing "N remaining" themselves.
//
// R3 Task 6 — a real class needs a school-authorisation attestation before it can be created
// ({ schoolAuthorised: true, version: ATTESTATION_VERSION }), or this throws AttestationError
// (400). `skipAttestation` is an INTERNAL flag, never settable from a request body — it exists
// only for classesCreateShells, which creates empty server-named class shells with no per-class
// checkbox in the UI to attest with; those shells still show the un-attested banner on Classes.jsx
// and must be attested via PUT /classes/{id}/attest before students can join (same posture as any
// other un-attested class — see joinRequestCreate's cut-off check).
async function createRealClass(classesContainer, { teacherId, schoolId, name, studentCount, attestation, skipAttestation = false }) {
  const trimmedName = (name || '').trim();
  if (!trimmedName || trimmedName.length > CLASS_NAME_MAX) {
    throw new Error(`name must be a non-empty string of ${CLASS_NAME_MAX} characters or fewer`);
  }

  if (!skipAttestation) {
    const valid = attestation && attestation.schoolAuthorised === true
      && versionState(attestation.version, ATTESTATION_VERSION) === 'current';
    if (!valid) throw new AttestationError();
  }

  const { resources: counts } = await classesContainer.items
    .query({
      query: 'SELECT VALUE COUNT(1) FROM c WHERE c.teacherId = @tid AND (NOT IS_DEFINED(c.isDemo) OR c.isDemo = false)',
      parameters: [{ name: '@tid', value: teacherId }],
    })
    .fetchAll();
  if ((counts[0] || 0) >= CLASSES_PER_TEACHER) {
    throw new ClassLimitError();
  }

  const now = new Date().toISOString();
  const doc = {
    id: crypto.randomUUID(),
    teacherId,
    schoolId: schoolId || null,
    name: trimmedName,
    studentCount: studentCount !== undefined ? Math.floor(studentCount) : 0,
    joinCode: generateJoinCode(),
    nameList: [],
    nameListEnabled: false,
    cap: 40,
    isDemo: false,
    attestedAt: skipAttestation ? null : now,
    attestationVersion: skipAttestation ? null : ATTESTATION_VERSION,
    createdAt: now,
  };
  const { resource } = await classesContainer.items.create(doc);
  return resource;
}

module.exports = { CLASS_NAME_MAX, CLASSES_PER_TEACHER, ClassLimitError, AttestationError, generateJoinCode, createRealClass };
