// Unit tests for the preset topic-tag enum (v4.0.0 comprehensive analytics).
// api/shared/topicTags.js has no Cosmos/env dependency, so it's imported directly.

const { TOPIC_TAGS, isValidTopicTag } = require('../../../api/shared/topicTags');

describe('topicTags — preset enum', () => {
  test('has exactly the 12 preset topics', () => {
    expect(TOPIC_TAGS).toHaveLength(12);
  });

  test('accepts every listed preset', () => {
    for (const t of TOPIC_TAGS) {
      expect(isValidTopicTag(t)).toBe(true);
    }
  });

  test('rejects an unknown topic string', () => {
    expect(isValidTopicTag('Random')).toBe(false);
    expect(isValidTopicTag('year 11 maths')).toBe(false); // case-sensitive, no normalisation
  });

  test('rejects non-string and empty input', () => {
    expect(isValidTopicTag(undefined)).toBe(false);
    expect(isValidTopicTag(null)).toBe(false);
    expect(isValidTopicTag('')).toBe(false);
    expect(isValidTopicTag(123)).toBe(false);
  });
});
