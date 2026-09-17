// v4.11.0 R2 (Erasure and opt-out) — unit tests for the fail-closed owner-erasure core.
// @azure/cosmos is mocked so importing manageErasure.js (builds a CosmosClient at load) stays offline;
// runErasure takes writeAudit/erase as deps, so the ordering is tested with plain fakes.
jest.mock('@azure/cosmos', () => ({ CosmosClient: class { database() { return { container() { return {}; } }; } } }));

const { runErasure } = require('../../../api/manageErasure');
const actor = { teacherId: 'OWNER', role: 'owner' };

describe('runErasure', () => {
  test('erasure is fail-closed — a requested-audit failure returns before erasing (erase never called)', async () => {
    const writeAudit = jest.fn(async ({ action }) => {
      if (action === 'privacy.erasure.requested') throw new Error('audit down');
    });
    const erase = jest.fn(async () => ({ responses: 3 }));

    await expect(
      runErasure({ writeAudit, erase }, { targetType: 'device', targetId: 'DEV', requestRef: 'ticket-1', actor }),
    ).rejects.toThrow('audit down');
    expect(erase).not.toHaveBeenCalled();
  });

  test('device happy path — requested audit, erase, completed audit with counts + requestRef (no manual-pending), returns counts', async () => {
    const seen = [];
    const writeAudit = jest.fn(async (e) => { seen.push(e); });
    const erase = jest.fn(async () => ({ responses: 3, pageviews: 2 }));

    const counts = await runErasure(
      { writeAudit, erase }, { targetType: 'device', targetId: 'DEV', requestRef: 'ticket-1', actor },
    );

    expect(counts).toEqual({ responses: 3, pageviews: 2 });
    expect(seen.map((e) => e.action)).toEqual(['privacy.erasure.requested', 'privacy.erasure.completed']);
    expect(seen[1].after).toEqual({ counts: { responses: 3, pageviews: 2 }, requestRef: 'ticket-1' });
  });

  test('teacher erasure records identityDeletion manual-pending on the completed audit', async () => {
    const seen = [];
    const writeAudit = jest.fn(async (e) => { seen.push(e); });
    const erase = jest.fn(async () => ({ teacher: 1 }));

    await runErasure({ writeAudit, erase }, { targetType: 'teacher', targetId: 'T', requestRef: 'email', actor });

    expect(seen[1].after).toEqual({ counts: { teacher: 1 }, requestRef: 'email', identityDeletion: 'manual-pending' });
  });

  test('a completed-audit failure is swallowed — onCompletedAuditError fires, counts still returned', async () => {
    const writeAudit = jest.fn(async ({ action }) => { if (action === 'privacy.erasure.completed') throw new Error('late'); });
    const erase = jest.fn(async () => ({ responses: 1 }));
    const onCompletedAuditError = jest.fn();

    const counts = await runErasure(
      { writeAudit, erase, onCompletedAuditError }, { targetType: 'device', targetId: 'DEV', requestRef: 'r', actor },
    );

    expect(counts).toEqual({ responses: 1 });
    expect(onCompletedAuditError).toHaveBeenCalledTimes(1);
  });
});
