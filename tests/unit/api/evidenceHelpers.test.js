// Unit tests for v4.1.0 Evidence export pure helpers. No Cosmos/env dependency.

const { calculateHours, containsUnpersonalisedMarker, validateDateRange } = require('../../../api/shared/evidenceHelpers');
const { domainCoverage } = require('../../../api/shared/apstContent');

describe('calculateHours — PD-hours auto-calculation', () => {
  test('3 quizzes -> 1.8hrs', () => {
    expect(calculateHours(3)).toBe(1.8);
  });
  test('0 quizzes -> 0hrs', () => {
    expect(calculateHours(0)).toBe(0);
  });
  test('1 quiz -> 0.6hrs', () => {
    expect(calculateHours(1)).toBe(0.6);
  });
});

describe('containsUnpersonalisedMarker — reflection personalisation gate', () => {
  test('flags a payload still containing the literal marker', () => {
    expect(containsUnpersonalisedMarker('I learnt that [PERSONALISE: something] happened.')).toBe(true);
  });
  test('passes a personalised payload', () => {
    expect(containsUnpersonalisedMarker('I learnt that most students struggled with ratios.')).toBe(false);
  });
  test('non-string input is never flagged', () => {
    expect(containsUnpersonalisedMarker(undefined)).toBe(false);
    expect(containsUnpersonalisedMarker(null)).toBe(false);
  });
});

describe('domainCoverage — APST domain-balance check', () => {
  test('all three domains present', () => {
    const coverage = domainCoverage(['3.3', '5.1', '6.2']);
    expect(coverage).toEqual({
      'Professional Knowledge': false,
      'Professional Practice': true,
      'Professional Engagement': true,
    });
  });
  test('engagement missing', () => {
    const coverage = domainCoverage(['3.3', '3.6']);
    expect(coverage['Professional Engagement']).toBe(false);
    expect(coverage['Professional Practice']).toBe(true);
  });
  test('unknown descriptor ids are ignored, not thrown', () => {
    expect(() => domainCoverage(['not-a-real-id'])).not.toThrow();
  });
});

describe('validateDateRange — annual-log range validation', () => {
  test('end-before-start is rejected', () => {
    const result = validateDateRange('2026-06-01', '2026-01-01');
    expect(result.valid).toBe(false);
  });
  test('more than 365 days is rejected', () => {
    const result = validateDateRange('2025-01-01', '2026-06-01');
    expect(result.valid).toBe(false);
  });
  test('a valid range passes', () => {
    const result = validateDateRange('2026-01-01', '2026-06-01');
    expect(result.valid).toBe(true);
  });
  test('invalid date strings are rejected', () => {
    expect(validateDateRange('not-a-date', '2026-06-01').valid).toBe(false);
  });
});
