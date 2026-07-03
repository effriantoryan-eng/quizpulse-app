// Preset topic tags for v4.0.0 comprehensive analytics + population benchmarking.
// Mirrors api/shared/topicTags.js (CommonJS backend vs ESM frontend — duplicated by convention,
// same pattern as CONFIDENCE_VALUES existing separately client- and server-side). Keep both lists
// in sync if the preset set changes.
//
// Topic is OPTIONAL when sending a quiz (design addendum D3) — the list doesn't cover every
// Year 7-12 subject, so it must never block send.
const TOPIC_TAGS = [
  'Year 7 Science', 'Year 8 Science', 'Year 9 Science', 'Year 10 Science',
  'Year 11 Maths', 'Year 12 Maths',
  'Year 7 English', 'Year 8 English', 'Year 9 English', 'Year 10 English',
  'Year 7 Humanities', 'Year 9 Humanities',
]

export default TOPIC_TAGS
