const { seededRng, seededShuffle, hashString } = require('../../../api/shared/seededRandom');

describe('seededRandom', () => {
  test('the same seed always produces the same sequence', () => {
    const a = seededRng('source-123');
    const b = seededRng('source-123');
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  test('different seeds produce different sequences', () => {
    const a = seededRng('source-123')();
    const b = seededRng('source-456')();
    expect(a).not.toBe(b);
  });

  test('seededShuffle is deterministic for the same seed', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled1 = seededShuffle(arr, seededRng('x'));
    const shuffled2 = seededShuffle(arr, seededRng('x'));
    expect(shuffled1).toEqual(shuffled2);
  });

  test('seededShuffle does not mutate the input array', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    seededShuffle(arr, seededRng('y'));
    expect(arr).toEqual(copy);
  });

  test('hashString is deterministic', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
  });
});
