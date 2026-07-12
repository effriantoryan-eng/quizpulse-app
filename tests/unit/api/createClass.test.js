// Unit tests for api/shared/createClass.js — the single place joinCode/schoolId/cap logic
// lives, adopted by both POST /api/classes and the v4.2.0 onboarding class-shells endpoint.

const { createRealClass, ClassLimitError, generateJoinCode } = require('../../../api/shared/createClass');

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
    const cls = await createRealClass(container, { teacherId: 't1', schoolId: 's1', name: 'Year 8 Science' });
    expect(cls.teacherId).toBe('t1');
    expect(cls.schoolId).toBe('s1');
    expect(cls.isDemo).toBe(false);
    expect(cls.joinCode).toHaveLength(8);
    expect(container.created).toHaveLength(1);
  });

  test('throws ClassLimitError (429) at the 20-class cap', async () => {
    const container = mockContainer(20);
    await expect(createRealClass(container, { teacherId: 't1', name: 'One too many' })).rejects.toBeInstanceOf(ClassLimitError);
  });

  test('rejects an empty name without creating a doc', async () => {
    const container = mockContainer(0);
    await expect(createRealClass(container, { teacherId: 't1', name: '   ' })).rejects.toThrow(/name/);
    expect(container.created).toHaveLength(0);
  });
});
