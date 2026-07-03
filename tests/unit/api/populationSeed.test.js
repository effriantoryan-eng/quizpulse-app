// Unit tests for the population benchmark seed's pure rollup math (v4.0.0).
// buildRollup/CORRECT_WEIGHT have no Cosmos/env dependency at require-time — main() only runs
// when the file is executed directly (require.main === module), so importing here is safe.

const { buildRollup, CORRECT_WEIGHT } = require('../../../api/seed/populationSeed');
const { TOPIC_TAGS } = require('../../../api/shared/topicTags');

describe('populationSeed — buildRollup', () => {
  test('every preset topic has a correctness weight', () => {
    for (const t of TOPIC_TAGS) {
      expect(CORRECT_WEIGHT[t]).toBeGreaterThan(0);
      expect(CORRECT_WEIGHT[t]).toBeLessThan(1);
    }
  });

  test('rollup pctCorrect matches the topic weight (within rounding)', () => {
    const rollup = buildRollup('Year 11 Maths');
    expect(rollup.topicTag).toBe('Year 11 Maths');
    expect(rollup.id).toBe('Year 11 Maths'); // id === topicTag (partition key)
    expect(rollup.pctCorrect).toBeCloseTo(CORRECT_WEIGHT['Year 11 Maths'] * 100, 1);
  });

  test('pctConfidentIncorrect is a fraction of the incorrect share, never exceeds it', () => {
    const rollup = buildRollup('Year 7 English');
    const pctIncorrect = 100 - rollup.pctCorrect;
    expect(rollup.pctConfidentIncorrect).toBeLessThanOrEqual(pctIncorrect);
    expect(rollup.pctConfidentIncorrect).toBeGreaterThan(0);
  });

  test('harder topics (lower weight) produce a lower pctCorrect', () => {
    const easier = buildRollup('Year 7 English');   // weight 0.71
    const harder = buildRollup('Year 12 Maths');     // weight 0.49
    expect(harder.pctCorrect).toBeLessThan(easier.pctCorrect);
  });

  test('responseCount is present and positive', () => {
    const rollup = buildRollup('Year 9 Humanities');
    expect(rollup.responseCount).toBeGreaterThan(0);
  });
});
