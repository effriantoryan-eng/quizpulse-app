// Unit tests for api/shared/profileSchema.js — v4.2.0 onboarding-wizard profile validation.

const { validateProfile, isProfileComplete, PROFILE_FIELDS } = require('../../../api/shared/profileSchema');

describe('validateProfile', () => {
  test('accepts a fully valid partial payload', () => {
    const { error, profile } = validateProfile({ subjects: ['Science', 'Maths'], classCount: 3 });
    expect(error).toBeUndefined();
    expect(profile).toEqual({ subjects: ['Science', 'Maths'], classCount: 3 });
  });

  test('accepts an empty object (every step skipped)', () => {
    const { error, profile } = validateProfile({});
    expect(error).toBeUndefined();
    expect(profile).toEqual({});
  });

  test('rejects an unknown subject', () => {
    const { error } = validateProfile({ subjects: ['Woodwork'] });
    expect(error).toMatch(/subjects/);
  });

  test('rejects more than 6 subjects', () => {
    const { error } = validateProfile({ subjects: Array(7).fill('Science') });
    expect(error).toMatch(/subjects/);
  });

  test('rejects a year level outside 7-12', () => {
    const { error } = validateProfile({ yearLevels: [6] });
    expect(error).toMatch(/yearLevels/);
  });

  test('rejects a non-integer classCount', () => {
    const { error } = validateProfile({ classCount: 2.5 });
    expect(error).toMatch(/classCount/);
  });

  test('rejects classCount above 20', () => {
    const { error } = validateProfile({ classCount: 21 });
    expect(error).toMatch(/classCount/);
  });

  test('rejects an invalid registrationStatus', () => {
    const { error } = validateProfile({ registrationStatus: 'retired' });
    expect(error).toMatch(/registrationStatus/);
  });

  test('accepts "undisclosed" registrationStatus', () => {
    const { error, profile } = validateProfile({ registrationStatus: 'undisclosed' });
    expect(error).toBeUndefined();
    expect(profile.registrationStatus).toBe('undisclosed');
  });

  test('rejects a non-object body', () => {
    expect(validateProfile(null).error).toBeDefined();
    expect(validateProfile('x').error).toBeDefined();
    expect(validateProfile([]).error).toBeDefined();
  });
});

describe('isProfileComplete', () => {
  test('false when any field is missing', () => {
    expect(isProfileComplete({})).toBe(false);
    expect(isProfileComplete({ subjects: ['Science'] })).toBe(false);
  });

  test('true only once all four fields are answered', () => {
    const full = { subjects: [], yearLevels: [], classCount: 1, registrationStatus: 'undisclosed' };
    expect(PROFILE_FIELDS.every((f) => f in full)).toBe(true);
    expect(isProfileComplete(full)).toBe(true);
  });

  test('a skipped step (field absent) does not count as answered even if value would be falsy', () => {
    // classCount: 0 would be falsy but is never valid (min 1); absence is the real "skipped" case.
    const missingOne = { subjects: [], yearLevels: [], registrationStatus: 'undisclosed' };
    expect(isProfileComplete(missingOne)).toBe(false);
  });
});
