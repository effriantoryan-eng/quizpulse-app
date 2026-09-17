// v4.11.0 R2 (Erasure and opt-out) — unit tests for the fail-closed account-deletion core.
// @azure/cosmos is mocked so importing accountDeletion.js (which builds a CosmosClient at load)
// doesn't reach a real account; runAccountDeletion takes its writeAudit/deleteTeacherAccount deps
// as arguments, so the ordering is tested with plain fakes.
jest.mock('@azure/cosmos', () => ({ CosmosClient: class { database() { return { container() { return {}; } }; } } }));

const { runAccountDeletion } = require('../../../api/accountDeletion');

describe('runAccountDeletion', () => {
  test('fail-closed — a requested-audit failure returns 500-equivalent before any deletion (deleteTeacherAccount never called)', async () => {
    const writeAudit = jest.fn(async ({ action }) => {
      if (action === 'account.deletion.requested') throw new Error('audit down');
    });
    const deleteTeacherAccount = jest.fn(async () => ({ teacher: 1 }));

    await expect(
      runAccountDeletion({ writeAudit, deleteTeacherAccount }, { teacherId: 'T', ip: '1.1.1.1' }),
    ).rejects.toThrow('audit down');
    expect(deleteTeacherAccount).not.toHaveBeenCalled();
  });

  test('happy path — requested audit then delete then completed audit (counts + manual-pending), returns counts', async () => {
    const seen = [];
    const writeAudit = jest.fn(async (e) => { seen.push(e); });
    const deleteTeacherAccount = jest.fn(async () => ({ teacher: 1, quizzes: 2 }));

    const counts = await runAccountDeletion({ writeAudit, deleteTeacherAccount }, { teacherId: 'T', ip: '2.2.2.2' });

    expect(counts).toEqual({ teacher: 1, quizzes: 2 });
    expect(seen.map((e) => e.action)).toEqual(['account.deletion.requested', 'account.deleted']);
    expect(seen[1].after).toEqual({ counts: { teacher: 1, quizzes: 2 }, identityDeletion: 'manual-pending' });
  });

  test('a completed-audit failure is swallowed — the data is already gone, onCompletedAuditError fires, counts still returned', async () => {
    const writeAudit = jest.fn(async ({ action }) => { if (action === 'account.deleted') throw new Error('late'); });
    const deleteTeacherAccount = jest.fn(async () => ({ teacher: 1 }));
    const onCompletedAuditError = jest.fn();

    const counts = await runAccountDeletion(
      { writeAudit, deleteTeacherAccount, onCompletedAuditError }, { teacherId: 'T' },
    );

    expect(counts).toEqual({ teacher: 1 });
    expect(onCompletedAuditError).toHaveBeenCalledTimes(1);
  });
});
