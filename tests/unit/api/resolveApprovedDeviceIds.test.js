const { resolveApprovedDeviceIds } = require('../../../api/shared/resolveApprovedDeviceIds');

function mockContainer(resources) {
  return { items: { query: () => ({ fetchAll: async () => ({ resources }) }) } };
}

describe('resolveApprovedDeviceIds', () => {
  test('empty classIds returns an empty set with no queries', async () => {
    const result = await resolveApprovedDeviceIds([], {
      classesContainer: mockContainer([]),
      joinRequestsContainer: mockContainer([]),
    });
    expect(result.size).toBe(0);
  });

  test('real class: reads approved deviceIds from join_requests', async () => {
    const classesContainer = mockContainer([{ id: 'c1', isDemo: false }]);
    const joinRequestsContainer = mockContainer([{ deviceId: 'd1' }, { deviceId: 'd2' }]);
    const result = await resolveApprovedDeviceIds(['c1'], { classesContainer, joinRequestsContainer });
    expect(result).toEqual(new Set(['d1', 'd2']));
  });

  test('demo class: reads deviceIds from demoStudents, never queries join_requests', async () => {
    const classesContainer = mockContainer([
      { id: 'c1', isDemo: true, demoStudents: [{ studentId: 'd1', name: 'A' }, { studentId: 'd2', name: 'B' }] },
    ]);
    let joinRequestsQueried = false;
    const joinRequestsContainer = {
      items: { query: () => { joinRequestsQueried = true; return { fetchAll: async () => ({ resources: [] }) }; } },
    };
    const result = await resolveApprovedDeviceIds(['c1'], { classesContainer, joinRequestsContainer });
    expect(result).toEqual(new Set(['d1', 'd2']));
    expect(joinRequestsQueried).toBe(false);
  });

  test('mixed demo + real classes: union of both sources', async () => {
    const classesContainer = mockContainer([
      { id: 'demo1', isDemo: true, demoStudents: [{ studentId: 'd1', name: 'A' }] },
      { id: 'real1', isDemo: false },
    ]);
    const joinRequestsContainer = mockContainer([{ deviceId: 'd2' }]);
    const result = await resolveApprovedDeviceIds(['demo1', 'real1'], { classesContainer, joinRequestsContainer });
    expect(result).toEqual(new Set(['d1', 'd2']));
  });

  test('a device approved in two classes is counted once (Set dedup)', async () => {
    const classesContainer = mockContainer([{ id: 'c1', isDemo: false }, { id: 'c2', isDemo: false }]);
    const joinRequestsContainer = mockContainer([{ deviceId: 'd1' }, { deviceId: 'd1' }]);
    const result = await resolveApprovedDeviceIds(['c1', 'c2'], { classesContainer, joinRequestsContainer });
    expect(result.size).toBe(1);
  });
});
