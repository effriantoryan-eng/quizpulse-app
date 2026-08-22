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
