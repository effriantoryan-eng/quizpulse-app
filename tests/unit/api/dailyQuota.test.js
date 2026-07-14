// Unit tests for api/shared/dailyQuota.js (v4.3.0). Mocked Cosmos containers — no live Cosmos.

const { countCreatedToday, checkAndIncrRegenQuota, todayDateKey } = require('../../../api/shared/dailyQuota');

function fakeContainer(count) {
  return {
    items: {
      query: () => ({ fetchAll: async () => ({ resources: [count] }) }),
    },
  };
}

describe('countCreatedToday', () => {
  test('returns the count from the query', async () => {
    const count = await countCreatedToday(fakeContainer(7), 't1');
    expect(count).toBe(7);
  });

  test('defaults to 0 when the query returns nothing', async () => {
    const container = { items: { query: () => ({ fetchAll: async () => ({ resources: [] }) }) } };
    expect(await countCreatedToday(container, 't1')).toBe(0);
  });
});

describe('checkAndIncrRegenQuota', () => {
  function fakeTeachersContainer(existingCount) {
    let patched = null;
    const item = {
      read: async () => ({ resource: existingCount === null ? {} : { [`quotaRegen_${todayDateKey()}`]: existingCount } }),
      patch: async (ops) => { patched = ops; },
    };
    return { container: { item: () => item }, getPatched: () => patched };
  }

  test('allows and increments when under the max', async () => {
    const { container, getPatched } = fakeTeachersContainer(5);
    const allowed = await checkAndIncrRegenQuota(container, 't1', 20);
    expect(allowed).toBe(true);
    expect(getPatched()).toEqual([{ op: 'incr', path: `/quotaRegen_${todayDateKey()}`, value: 1 }]);
  });

  test('rejects at the max without patching', async () => {
    const { container, getPatched } = fakeTeachersContainer(20);
    const allowed = await checkAndIncrRegenQuota(container, 't1', 20);
    expect(allowed).toBe(false);
    expect(getPatched()).toBeNull();
  });

  test('a teacher doc with no counter field yet starts from 0', async () => {
    const { container } = fakeTeachersContainer(null);
    const allowed = await checkAndIncrRegenQuota(container, 't1', 20);
    expect(allowed).toBe(true);
  });
});

describe('todayDateKey', () => {
  test('formats as YYYYMMDD', () => {
    expect(todayDateKey()).toMatch(/^\d{8}$/);
  });
});
