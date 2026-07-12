// v4.2.0 — teacher profile validation. Profile is optional/additive: a legacy teacher doc with
// no `profile` field is valid and treated as an empty profile everywhere (introEligibility,
// GET /api/me, the topic prefilter).

const SUBJECTS = ['Science', 'Maths', 'English', 'Humanities', 'Other'];
const REGISTRATION_STATUSES = ['provisional', 'full', 'undisclosed'];
const MAX_SUBJECTS = 6;
const MAX_YEAR_LEVELS = 6;
const MIN_YEAR_LEVEL = 7;
const MAX_YEAR_LEVEL = 12;
const MIN_CLASS_COUNT = 1;
const MAX_CLASS_COUNT = 20;

// Fields that together determine profileComplete — a skipped step is NOT "answered", so
// profileComplete only flips true once every one of these keys is present on the profile.
const PROFILE_FIELDS = ['subjects', 'yearLevels', 'classCount', 'registrationStatus'];

// Validates a partial profile payload (any subset of fields — the wizard submits once at the
// end with whatever wasn't skipped). Returns { error } on the first violation, else { profile }
// with only the recognised, validated fields carried through.
function validateProfile(body) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'profile must be an object' };
  }
  const profile = {};

  if ('subjects' in body) {
    const { subjects } = body;
    if (!Array.isArray(subjects) || subjects.length > MAX_SUBJECTS || subjects.some((s) => !SUBJECTS.includes(s))) {
      return { error: `subjects must be an array of up to ${MAX_SUBJECTS} values from: ${SUBJECTS.join(', ')}` };
    }
    profile.subjects = subjects;
  }

  if ('yearLevels' in body) {
    const { yearLevels } = body;
    if (
      !Array.isArray(yearLevels) ||
      yearLevels.length > MAX_YEAR_LEVELS ||
      yearLevels.some((y) => !Number.isInteger(y) || y < MIN_YEAR_LEVEL || y > MAX_YEAR_LEVEL)
    ) {
      return { error: `yearLevels must be an array of up to ${MAX_YEAR_LEVELS} integers between ${MIN_YEAR_LEVEL} and ${MAX_YEAR_LEVEL}` };
    }
    profile.yearLevels = yearLevels;
  }

  if ('classCount' in body) {
    const { classCount } = body;
    if (!Number.isInteger(classCount) || classCount < MIN_CLASS_COUNT || classCount > MAX_CLASS_COUNT) {
      return { error: `classCount must be an integer between ${MIN_CLASS_COUNT} and ${MAX_CLASS_COUNT}` };
    }
    profile.classCount = classCount;
  }

  if ('registrationStatus' in body) {
    const { registrationStatus } = body;
    if (!REGISTRATION_STATUSES.includes(registrationStatus)) {
      return { error: `registrationStatus must be one of: ${REGISTRATION_STATUSES.join(', ')}` };
    }
    profile.registrationStatus = registrationStatus;
  }

  return { profile };
}

// profileComplete = every one of the four profile fields has been answered (present on the
// merged profile object) — a skipped wizard step means the field is simply absent, not answered.
function isProfileComplete(profile) {
  return !!profile && PROFILE_FIELDS.every((f) => profile[f] !== undefined);
}

module.exports = {
  SUBJECTS,
  REGISTRATION_STATUSES,
  MAX_SUBJECTS,
  MAX_YEAR_LEVELS,
  MIN_YEAR_LEVEL,
  MAX_YEAR_LEVEL,
  MIN_CLASS_COUNT,
  MAX_CLASS_COUNT,
  PROFILE_FIELDS,
  validateProfile,
  isProfileComplete,
};
