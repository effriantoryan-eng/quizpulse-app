// Subscription-tier plumbing. Pure/offline — no Cosmos, no func host.
const { TIERS, tierOf, hasTier, requireTier, TierError } = require('../../../api/shared/entitlements');

describe('tierOf', () => {
  test('legacy doc with no tier field reads as free', () => {
    expect(tierOf({})).toBe('free');
    expect(tierOf(null)).toBe('free');
  });
  test('unknown value fails closed to free', () => {
    expect(tierOf({ tier: 'platinum' })).toBe('free');
  });
  test('known tiers pass through', () => {
    TIERS.forEach((t) => expect(tierOf({ tier: t })).toBe(t));
  });
});

describe('hasTier — ordering', () => {
  test('higher tier includes lower', () => {
    expect(hasTier({ tier: 'pro' }, 'free')).toBe(true);
    expect(hasTier({ tier: 'school' }, 'pro')).toBe(true);
  });
  test('lower tier does not reach higher', () => {
    expect(hasTier({ tier: 'free' }, 'pro')).toBe(false);
    expect(hasTier({ tier: 'pro' }, 'school')).toBe(false);
  });
  test('same tier qualifies', () => {
    expect(hasTier({ tier: 'pro' }, 'pro')).toBe(true);
  });
});

describe('requireTier', () => {
  test('passes and returns teacher when tier is high enough', () => {
    const t = { tier: 'pro' };
    expect(requireTier(t, 'pro')).toBe(t);
  });
  test('throws TierError with 402 + machine-readable body when below', () => {
    let err;
    try { requireTier({ tier: 'free' }, 'pro'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(TierError);
    expect(err.status).toBe(402);
    expect(err.body).toEqual({ error: 'Upgrade required', upgradeRequired: true, requiredTier: 'pro', currentTier: 'free' });
  });
  test('typo in minTier throws loudly (never silently gives a paid feature away)', () => {
    expect(() => requireTier({ tier: 'free' }, 'premuim')).toThrow(/Unknown tier/);
  });
});
