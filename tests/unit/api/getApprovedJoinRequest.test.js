const { getApprovedJoinRequest } = require('../../../api/shared/getApprovedJoinRequest');

function mockContainer(resources) {
  return { items: { query: () => ({ fetchAll: async () => ({ resources }) }) } };
}

describe('getApprovedJoinRequest', () => {
  test('returns the approved doc (carries teacherId) when one exists', async () => {
    const container = mockContainer([{ id: 'r1', deviceId: 'd1', classId: 'c1', status: 'approved', teacherId: 't1' }]);
    const result = await getApprovedJoinRequest(container, 'd1', 'c1');
    expect(result).toEqual({ id: 'r1', deviceId: 'd1', classId: 'c1', status: 'approved', teacherId: 't1' });
  });

  test('returns null when there is no approved request — the cross-tenant/unapproved case', async () => {
    const container = mockContainer([]);
    const result = await getApprovedJoinRequest(container, 'd1', 'c1');
    expect(result).toBeNull();
  });
});
