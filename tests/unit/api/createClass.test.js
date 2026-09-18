// Unit tests for api/shared/createClass.js — the single place joinCode/schoolId/cap/attestation
// logic lives, adopted by both POST /api/classes and the v4.2.0 onboarding class-shells endpoint.

const { createRealClass, ClassLimitError, AttestationError, generateJoinCode } = require('../../../api/shared/createClass');
const { ATTESTATION_VERSION } = require('../../../api/shared/legalVersions');

const VALID_ATTESTATION = { schoolAuthorised: true, version: ATTESTATION_VERSION };

function mockContainer(existingCount) {
  const created = [];
  return {
    created,
    items: {
      query: () => ({
        fetchAll: async () => ({ resources: [existingCount] }),
      }),
      create: async (doc) => {
        created.push(doc);
        return { resource: doc };
      },
    },
  };
}

describe('generateJoinCode', () => {
  test('is 8 characters, alphanumeric, excluding ambiguous chars', () => {
    const code = generateJoinCode();
    expect(code).toHaveLength(8);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });
});

describe('createRealClass', () => {
  test('creates a class doc with a join code and denormalised schoolId', async () => {
    const container = mockContainer(0);
    const cls = await createRealClass(container, { teacherId: 't1', schoolId: 's1', name: 'Year 8 Science', attestation: VALID_ATTESTATION });
    expect(cls.teacherId).toBe('t1');
    expect(cls.schoolId).toBe('s1');
    expect(cls.isDemo).toBe(false);
    expect(cls.joinCode).toHaveLength(8);
    expect(container.created).toHaveLength(1);
  });

  test('throws ClassLimitError (429) at the 20-class cap', async () => {
    const container = mockContainer(20);
    await expect(createRealClass(container, { teacherId: 't1', name: 'One too many', attestation: VALID_ATTESTATION })).rejects.toBeInstanceOf(ClassLimitError);
  });

  test('rejects an empty name without creating a doc', async () => {
    const container = mockContainer(0);
    await expect(createRealClass(container, { teacherId: 't1', name: '   ', attestation: VALID_ATTESTATION })).rejects.toThrow(/name/);
    expect(container.created).toHaveLength(0);
  });
});

// R3 Task 6 — attestation requirement (test contract row).
describe('createRealClass — attestation (R3)', () => {
  test('missing attestation throws AttestationError, creates no doc', async () => {
    const container = mockContainer(0);
    await expect(createRealClass(container, { teacherId: 't1', name: 'No attestation' })).rejects.toBeInstanceOf(AttestationError);
    expect(container.created).toHaveLength(0);
  });

  test('wrong attestation version throws AttestationError', async () => {
    const container = mockContainer(0);
    await expect(createRealClass(container, {
      teacherId: 't1', name: 'Stale', attestation: { schoolAuthorised: true, version: 'old-version' },
    })).rejects.toBeInstanceOf(AttestationError);
    expect(container.created).toHaveLength(0);
  });

  test('schoolAuthorised: false throws AttestationError even with the right version', async () => {
    const container = mockContainer(0);
    await expect(createRealClass(container, {
      teacherId: 't1', name: 'Not authorised', attestation: { schoolAuthorised: false, version: ATTESTATION_VERSION },
    })).rejects.toBeInstanceOf(AttestationError);
  });

  test('valid attestation creates a class with attestedAt + attestationVersion stamped', async () => {
    const container = mockContainer(0);
    const cls = await createRealClass(container, { teacherId: 't1', name: 'Valid', attestation: VALID_ATTESTATION });
    expect(cls.attestedAt).toEqual(expect.any(String));
    expect(cls.attestationVersion).toBe(ATTESTATION_VERSION);
  });

  test('skipAttestation (internal, server-created shells) bypasses the check and leaves attestedAt null', async () => {
    const container = mockContainer(0);
    const cls = await createRealClass(container, { teacherId: 't1', name: 'Shell', skipAttestation: true });
    expect(cls.attestedAt).toBeNull();
    expect(cls.attestationVersion).toBeNull();
    expect(container.created).toHaveLength(1);
  });
});
