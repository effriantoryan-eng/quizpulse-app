// Unit tests for the fuzzy match helper used in join request name validation.
// Tests exact match, near match, and no-match cases at the fuse.js threshold=0.4.

const { runFuzzyMatch } = require('../../../api/fuzzyMatchHelper');

describe('runFuzzyMatch', () => {
  const nameList = ['Alice Smith', 'Bob Jones', 'Carol Williams', 'David Brown'];

  test('exact match returns score 1', () => {
    const { matchedName, matchScore } = runFuzzyMatch(nameList, 'Alice Smith');
    expect(matchedName).toBe('Alice Smith');
    expect(matchScore).toBeCloseTo(1, 2);
  });

  test('near match returns a matched name and score ≥ 0.6', () => {
    const { matchedName, matchScore } = runFuzzyMatch(nameList, 'Alic Smih'); // typo
    expect(matchedName).toBe('Alice Smith');
    expect(matchScore).toBeGreaterThanOrEqual(0.6);
    expect(matchScore).toBeLessThanOrEqual(1);
  });

  test('no match returns null matchedName and score 0', () => {
    const { matchedName, matchScore } = runFuzzyMatch(nameList, 'Zephyr Quantum');
    expect(matchedName).toBeNull();
    expect(matchScore).toBe(0);
  });

  test('empty name list returns null matchedName', () => {
    const { matchedName, matchScore } = runFuzzyMatch([], 'Alice Smith');
    expect(matchedName).toBeNull();
    expect(matchScore).toBe(0);
  });

  test('null name list returns null matchedName', () => {
    const { matchedName, matchScore } = runFuzzyMatch(null, 'Alice Smith');
    expect(matchedName).toBeNull();
    expect(matchScore).toBe(0);
  });

  test('matchScore is stored as similarity (1 = perfect, closer to 0 = no match)', () => {
    const exact = runFuzzyMatch(nameList, 'Bob Jones');
    const near = runFuzzyMatch(nameList, 'Bob Joens');
    const miss = runFuzzyMatch(nameList, 'Zzzzz');
    expect(exact.matchScore).toBeGreaterThan(near.matchScore);
    expect(near.matchScore).toBeGreaterThan(miss.matchScore);
  });

  test('case-insensitive near match', () => {
    const { matchedName } = runFuzzyMatch(nameList, 'alice smith');
    expect(matchedName).toBe('Alice Smith');
  });
});
