// v4.0.0 four-cell chart (correctness × confidence) palette + cell definitions, shared so the
// Analytics drill-down and the v4.6.0 first-run payoff screen render the identical chart and can
// never drift on the misconception accent color or cell labels.
//
// Misconception accent — one color for the signal everywhere it appears (per-question four-cell
// "incorrect, confident" segment and the promoted hero card). Deliberately NOT purple (would
// collide with the demo-pill purple) and NOT the amber used elsewhere — a dedicated, distinct
// accent per DESIGN_REVIEW_v400_v410_addendum.md §D5.
export const MISCONCEPTION_BG = '#FBEDE8'
export const MISCONCEPTION_BORDER = '#B5482E'

// Always shown with visible counts/labels (never color- or hover-only, per §D4).
// incorrectConfident reuses the misconception accent.
export const FOUR_CELL = [
  { key: 'correctConfident', label: 'Correct, confident', bg: '#DCEFC8', border: '#3B6D11' },
  { key: 'correctUnsure', label: 'Correct, unsure', bg: '#EEF6E4', border: '#6B9A44' },
  { key: 'incorrectConfident', label: 'Misconception', bg: MISCONCEPTION_BG, border: MISCONCEPTION_BORDER },
  { key: 'incorrectUnsure', label: 'Incorrect, unsure', bg: '#FDF3E3', border: '#B8860B' },
]
