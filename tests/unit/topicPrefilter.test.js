// Unit tests for src/data/topicPrefilter.js's matchTopics logic — v4.2.0 SendQuiz topic dropdown
// prefilter. The source is an ESM module (Vite-only); Jest's CJS runner can't require() it
// directly, so this mirrors the logic for isolated testing (same convention as responses.test.js).

function matchTopics(subjects, yearLevels, tags) {
  if (!subjects?.length || !yearLevels?.length) return []
  return tags.filter(
    (t) => yearLevels.some((y) => t.startsWith(`Year ${y} `)) && subjects.some((s) => t.endsWith(` ${s}`))
  )
}

const TAGS = [
  'Year 7 Science', 'Year 8 Science', 'Year 9 Science', 'Year 10 Science',
  'Year 11 Maths', 'Year 12 Maths',
  'Year 7 English', 'Year 8 English', 'Year 9 English', 'Year 10 English',
  'Year 7 Humanities', 'Year 9 Humanities',
]

describe('matchTopics', () => {
  test('returns tags matching both a subject and a year level', () => {
    expect(matchTopics(['Science'], [7, 8], TAGS)).toEqual(['Year 7 Science', 'Year 8 Science']);
  });

  test('zero-match fallback: an unanswered combination (e.g. Year 8 Maths) returns empty', () => {
    expect(matchTopics(['Maths'], [8], TAGS)).toEqual([]);
  });

  test('returns empty when subjects is empty (profile step skipped)', () => {
    expect(matchTopics([], [7, 8], TAGS)).toEqual([]);
  });

  test('returns empty when yearLevels is empty (profile step skipped)', () => {
    expect(matchTopics(['Science'], [], TAGS)).toEqual([]);
  });

  test('returns empty when profile is entirely undefined', () => {
    expect(matchTopics(undefined, undefined, TAGS)).toEqual([]);
  });

  test('matches across multiple subjects and year levels', () => {
    const result = matchTopics(['English', 'Humanities'], [7, 9], TAGS);
    expect(result).toEqual(expect.arrayContaining(['Year 7 English', 'Year 9 English', 'Year 7 Humanities', 'Year 9 Humanities']));
    expect(result).toHaveLength(4);
  });
});
