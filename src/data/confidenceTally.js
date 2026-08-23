// Pure tally of a submission's confidence mix — v4.7.0 T5 completion self-summary.
// answersPayload: [{ questionId, confidence }] — the same shape TakeQuiz.jsx already builds for
// POST /api/responses, so the finish screen renders straight from what was just submitted with no
// new endpoint and no re-derivation risk (it can't drift from what the server actually received).
export function tallyConfidence(answersPayload) {
  const tally = { sure: 0, pretty_sure: 0, guessing: 0 }
  for (const a of answersPayload) {
    if (a.confidence in tally) tally[a.confidence] += 1
  }
  return tally
}

export function tallySummaryText(tally) {
  const parts = []
  if (tally.sure) parts.push(`${tally.sure} sure`)
  if (tally.pretty_sure) parts.push(`${tally.pretty_sure} pretty sure`)
  if (tally.guessing) parts.push(`${tally.guessing} guessing`)
  return parts.join(' / ')
}

// One source for the human-facing confidence labels — mirrored from TakeQuiz's CONFIDENCE_LEVELS
// so the review screen's chips read identically to the picker the student used.
export const CONFIDENCE_LABELS = { sure: 'Sure', pretty_sure: 'Pretty sure', guessing: 'Just guessing' }

// E1 — one gentle, participation-framed line about how sure the student has felt across their
// recent quizzes. Returns null when there's too little history to say anything honest (< 2 quizzes,
// or no confidence data). Never a score, never correctness — same house rule as the completion
// summary.
export function confidenceTrend(payloads) {
  if (!payloads || payloads.length < 2) return null
  const total = { sure: 0, pretty_sure: 0, guessing: 0 }
  let n = 0
  for (const p of payloads) {
    for (const a of (p.answers || [])) {
      if (a.confidence in total) { total[a.confidence] += 1; n += 1 }
    }
  }
  if (n === 0) return null
  const confidentRatio = (total.sure + total.pretty_sure) / n
  const guessRatio = total.guessing / n
  if (guessRatio >= 0.5) return 'Lots of "just guessing" lately — that\'s exactly how learning starts.'
  if (confidentRatio >= 0.75) return "You've been feeling sure of yourself lately. Nice."
  return "A good mix of sure and unsure — that's what learning feels like."
}
