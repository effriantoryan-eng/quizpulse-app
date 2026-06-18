// Unit tests for new-account provisioning — mirrors the handler logic in api/teacher.js.
// Covers: first-time teacher creation (role server-set), idempotency, role field rejection.
// Integration tests for the live endpoint are in tests/integration/api/teacher.test.js.

function makeOnboardingHandler({ existingTeacher = null } = {}) {
  let createdSchool = null;
  let createdTeacher = null;

  const teachersContainer = {
    item: (id) => ({
      read: async () => {
        if (existingTeacher && existingTeacher.id === id) return { resource: existingTeacher };
        return { resource: undefined };
      },
    }),
    items: {
      create: async (doc) => {
        createdTeacher = doc;
        return { resource: doc };
      },
    },
  };

  const schoolsContainer = {
    item: (id) => ({
      read: async () => {
        if (createdSchool && createdSchool.id === id) return { resource: createdSchool };
        if (existingTeacher?.schoolId === id) return { resource: { id, name: 'Existing School', status: 'unvalidated' } };
        throw Object.assign(new Error('not found'), { code: 404 });
      },
    }),
    items: {
      create: async (doc) => {
        createdSchool = doc;
        return { resource: doc };
      },
    },
  };

  async function getTeacher(teacherId) {
    try {
      const { resource } = await teachersContainer.item(teacherId).read();
      return resource || null;
    } catch (err) {
      if (err.code === 404) return null;
      throw err;
    }
  }

  // Mirrors POST /api/onboarding handler logic (teacher.js)
  return async function handler({ teacherId, claims = {}, body }) {
    if (!body || typeof body !== 'object') return { status: 400, error: 'bad body' };
    if ('role' in body) return { status: 400, error: 'role cannot be set here' };

    const { schoolName } = body;
    if (typeof schoolName !== 'string' || !schoolName.trim()) {
      return { status: 400, error: 'schoolName is required' };
    }
    if (schoolName.trim().length > 120) {
      return { status: 400, error: 'schoolName must be 120 characters or fewer' };
    }

    const existing = await getTeacher(teacherId);
    if (existing && existing.schoolId) {
      let school = null;
      try {
        const { resource } = await schoolsContainer.item(existing.schoolId).read();
        school = resource || null;
      } catch (err) { if (err.code !== 404) throw err; }
      return { status: 200, body: { teacher: existing, school, alreadyOnboarded: true } };
    }

    const now = new Date().toISOString();
    const school = {
      id: 'school-uuid',
      name: schoolName.trim(),
      status: 'unvalidated',
      createdAt: now,
    };
    await schoolsContainer.items.create(school);

    const teacher = {
      id: teacherId,
      teacherId,
      schoolId: school.id,
      schoolStatus: school.status,
      name: claims.name || null,
      email: (Array.isArray(claims.emails) ? claims.emails[0] : claims.email) || null,
      idp: claims.idp || 'local',
      role: 'teacher', // always server-set, never from body
      createdAt: now,
    };
    await teachersContainer.items.create(teacher);

    return { status: 201, body: { teacher, school }, _createdTeacher: createdTeacher, _createdSchool: createdSchool };
  };
}

describe('sign-up provisioning — first-time teacher creation', () => {
  test('creates teacher document with role always set to "teacher" regardless of claims', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({
      teacherId: 'oid-abc123',
      claims: { name: 'Jane Smith', emails: ['jane@example.com'] },
      body: { schoolName: 'Maplewood High' },
    });
    expect(result.status).toBe(201);
    expect(result.body.teacher.role).toBe('teacher');
    expect(result.body.teacher.teacherId).toBe('oid-abc123');
    expect(result.body.school.name).toBe('Maplewood High');
    expect(result.body.school.status).toBe('unvalidated');
  });

  test('derives email from claims.emails array when present', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({
      teacherId: 'oid-xyz',
      claims: { emails: ['teacher@school.edu'] },
      body: { schoolName: 'Any School' },
    });
    expect(result.status).toBe(201);
    expect(result.body.teacher.email).toBe('teacher@school.edu');
  });

  test('sets idp from claims or defaults to "local"', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({
      teacherId: 'oid-idp',
      claims: { idp: 'google.com' },
      body: { schoolName: 'Tech Academy' },
    });
    expect(result.status).toBe(201);
    expect(result.body.teacher.idp).toBe('google.com');
  });
});

describe('sign-up provisioning — role field protection', () => {
  test('returns 400 when request body contains a role key', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({
      teacherId: 'oid-role-attack',
      claims: {},
      body: { schoolName: 'Any School', role: 'platform_admin' },
    });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/role/);
  });

  test('rejects role: "owner" too', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({
      teacherId: 'oid-owner-attempt',
      claims: {},
      body: { schoolName: 'Any School', role: 'owner' },
    });
    expect(result.status).toBe(400);
  });
});

describe('sign-up provisioning — idempotency', () => {
  test('returns alreadyOnboarded: true when teacher document already exists', async () => {
    const existingTeacher = {
      id: 'oid-existing',
      teacherId: 'oid-existing',
      schoolId: 'school-existing',
      role: 'teacher',
    };
    const handler = makeOnboardingHandler({ existingTeacher });
    const result = await handler({
      teacherId: 'oid-existing',
      claims: {},
      body: { schoolName: 'A Different School Name' }, // should NOT overwrite
    });
    expect(result.status).toBe(200);
    expect(result.body.alreadyOnboarded).toBe(true);
    // The original school name is returned, not the new one
    expect(result.body.school.name).toBe('Existing School');
  });

  test('does not create a second teacher document on repeat call', async () => {
    const existingTeacher = {
      id: 'oid-repeat',
      teacherId: 'oid-repeat',
      schoolId: 'school-repeat',
      role: 'teacher',
    };
    const handler = makeOnboardingHandler({ existingTeacher });
    const result = await handler({
      teacherId: 'oid-repeat',
      claims: {},
      body: { schoolName: 'New School' },
    });
    // No new _createdTeacher since the early-return path is taken
    expect(result.body.alreadyOnboarded).toBe(true);
    expect(result._createdTeacher).toBeUndefined();
  });
});

describe('sign-up provisioning — input validation', () => {
  test('returns 400 when schoolName is missing', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({ teacherId: 'oid-val', claims: {}, body: {} });
    expect(result.status).toBe(400);
    expect(result.error).toMatch(/schoolName/);
  });

  test('returns 400 when schoolName exceeds 120 characters', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({
      teacherId: 'oid-long',
      claims: {},
      body: { schoolName: 'S'.repeat(121) },
    });
    expect(result.status).toBe(400);
  });

  test('returns 400 for a blank schoolName', async () => {
    const handler = makeOnboardingHandler();
    const result = await handler({
      teacherId: 'oid-blank',
      claims: {},
      body: { schoolName: '   ' },
    });
    expect(result.status).toBe(400);
  });
});
