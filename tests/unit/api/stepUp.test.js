// Unit tests for api/shared/stepUp.js — the step-up re-auth guard for owner-gated destructive
// actions (school merge, and any future destructive admin endpoint).

const { assertStepUp, StepUpError, STEP_UP_WINDOW_MS } = require('../../../api/shared/stepUp');

describe('assertStepUp', () => {
  test('passes when auth_time is well within the window', () => {
    const claims = { auth_time: Math.floor(Date.now() / 1000) };
    expect(() => assertStepUp(claims)).not.toThrow();
  });

  test('passes when auth_time is just inside the window', () => {
    const justInside = Math.floor((Date.now() - (STEP_UP_WINDOW_MS - 1000)) / 1000);
    expect(() => assertStepUp({ auth_time: justInside })).not.toThrow();
  });

  test('throws when auth_time is just outside the window', () => {
    const justOutside = Math.floor((Date.now() - (STEP_UP_WINDOW_MS + 1000)) / 1000);
    expect(() => assertStepUp({ auth_time: justOutside })).toThrow(StepUpError);
  });

  test('falls back to iat when auth_time is absent', () => {
    const claims = { iat: Math.floor(Date.now() / 1000) };
    expect(() => assertStepUp(claims)).not.toThrow();
  });

  test('throws when neither auth_time nor iat is present (fails closed)', () => {
    expect(() => assertStepUp({})).toThrow(StepUpError);
  });

  test('the thrown error carries status 401 and reauthRequired: true', () => {
    try {
      assertStepUp({});
      throw new Error('expected assertStepUp to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(StepUpError);
      expect(err.status).toBe(401);
      expect(err.reauthRequired).toBe(true);
    }
  });
});
