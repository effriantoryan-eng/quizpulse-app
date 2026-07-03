// Preset topic tags for v4.0.0 comprehensive analytics + population benchmarking.
// Free-text topics are deferred (see CLAUDE.md — Comprehensive analytics & population
// benchmarking). Topic tag is OPTIONAL on send (design addendum D3) — this list is not
// exhaustive of every Year 7-12 subject, so it must never block a teacher from sending.
const TOPIC_TAGS = [
  'Year 7 Science', 'Year 8 Science', 'Year 9 Science', 'Year 10 Science',
  'Year 11 Maths', 'Year 12 Maths',
  'Year 7 English', 'Year 8 English', 'Year 9 English', 'Year 10 English',
  'Year 7 Humanities', 'Year 9 Humanities',
];

function isValidTopicTag(value) {
  return typeof value === 'string' && TOPIC_TAGS.includes(value);
}

module.exports = { TOPIC_TAGS, isValidTopicTag };
