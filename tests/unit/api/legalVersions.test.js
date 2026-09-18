// Unit tests for api/shared/legalVersions.js — version-equality validation and the D3.4
// attestation cut-off. The cut-off's fail-open behavior is the load-bearing property here (a
// misconfigured/absent cut-off must never block a join — see the module's own comment).

describe('versionState', () => {
  let legalVersions;
  beforeEach(() => { jest.resetModules(); legalVersions = require('../../../api/shared/legalVersions'); });

  const CURRENT = 'v-current';

  test('missing/null/empty provided version is "absent"', () => {
    expect(legalVersions.versionState(undefined, CURRENT)).toBe('absent');
    expect(legalVersions.versionState(null, CURRENT)).toBe('absent');
    expect(legalVersions.versionState('', CURRENT)).toBe('absent');
  });

  test('a version that does not match current is "stale"', () => {
    expect(legalVersions.versionState('v-old', CURRENT)).toBe('stale');
  });

  test('a version that matches current is "current"', () => {
    expect(legalVersions.versionState(CURRENT, CURRENT)).toBe('current');
  });
});

describe('attestationCutoffMs / attestationRequiredNow — fail-open (D3.4, critical)', () => {
  const OLD_ENV = process.env.ATTESTATION_REQUIRED_FROM;
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.ATTESTATION_REQUIRED_FROM;
    else process.env.ATTESTATION_REQUIRED_FROM = OLD_ENV;
    jest.resetModules();
  });

  test('unset env var → cutoff is Infinity, never blocks a join', () => {
    delete process.env.ATTESTATION_REQUIRED_FROM;
    jest.resetModules();
    const { attestationCutoffMs, attestationRequiredNow } = require('../../../api/shared/legalVersions');
    expect(attestationCutoffMs()).toBe(Infinity);
    expect(attestationRequiredNow(Date.now())).toBe(false);
    expect(attestationRequiredNow(0)).toBe(false); // the exact regression this guards: now >= null coerces to true
  });

  test('an invalid/unparseable date string also fails open to Infinity', () => {
    process.env.ATTESTATION_REQUIRED_FROM = 'not-a-real-date';
    jest.resetModules();
    const { attestationCutoffMs, attestationRequiredNow } = require('../../../api/shared/legalVersions');
    expect(attestationCutoffMs()).toBe(Infinity);
    expect(attestationRequiredNow()).toBe(false);
  });

  test('a real past date starts blocking un-attested joins', () => {
    process.env.ATTESTATION_REQUIRED_FROM = '2020-01-01T00:00:00.000Z';
    jest.resetModules();
    const { attestationRequiredNow } = require('../../../api/shared/legalVersions');
    expect(attestationRequiredNow(Date.now())).toBe(true);
  });

  test('a real future date does not yet block', () => {
    process.env.ATTESTATION_REQUIRED_FROM = '2099-01-01T00:00:00.000Z';
    jest.resetModules();
    const { attestationRequiredNow } = require('../../../api/shared/legalVersions');
    expect(attestationRequiredNow(Date.now())).toBe(false);
  });
});

// Test contract row: "Attestation cut-off logic — un-attested before the date; un-attested after;
// attested after; demo class — allowed; blocked; allowed; allowed". The cut-off function itself
// only decides "is a class-level attestation check gated at all right now" — the per-class
// allow/block decision (attestedAt present, or demo) is exercised in
// tests/integration/api/v4.12.0-notice-consent.test.js against the real joinRequestCreate handler.
describe('attestation cut-off — per-class allow/block matrix (pure logic mirror)', () => {
  function joinAllowed({ attestedAt, isDemo }, requiredNow) {
    if (isDemo) return true; // demo classes are never joinable — the check never applies
    if (attestedAt) return true;
    return !requiredNow;
  }

  test('un-attested class before the cut-off → allowed (grace period)', () => {
    expect(joinAllowed({ attestedAt: null, isDemo: false }, /* requiredNow */ false)).toBe(true);
  });

  test('un-attested class after the cut-off → blocked', () => {
    expect(joinAllowed({ attestedAt: null, isDemo: false }, /* requiredNow */ true)).toBe(false);
  });

  test('attested class after the cut-off → allowed', () => {
    expect(joinAllowed({ attestedAt: '2026-01-01T00:00:00.000Z', isDemo: false }, /* requiredNow */ true)).toBe(true);
  });

  test('a demo class is always allowed regardless of attestation or cut-off', () => {
    expect(joinAllowed({ attestedAt: null, isDemo: true }, /* requiredNow */ true)).toBe(true);
  });
});
