// Pure derivation of the v4.7.0 T1 "Also waiting" attention cards from data the Home page already
// fetches (api/dashboard.js's activeQuizzes/recentResults, plus the teacher's full quiz list for
// the draft-in-progress signal) — no new endpoint. Extracted for unit testing.

// No "target score" concept exists in this app's data model (quizzes are formative, not graded
// against a set target) — "below target" is a response-rate proxy, not a score threshold.
export const BELOW_TARGET_RESPONSE_RATE = 60

export function buildAlsoWaitingCards({ activeQuizzes = [], recentResults = [], quizzes = [] }) {
  const cards = []

  const nonSubmitter = activeQuizzes.find((q) => q.classSize > 0 && q.totalResponses < q.classSize)
  if (nonSubmitter) {
    cards.push({
      type: 'nonSubmitters',
      quizId: nonSubmitter.quizId,
      name: nonSubmitter.name,
      count: nonSubmitter.classSize - nonSubmitter.totalResponses,
      total: nonSubmitter.classSize,
    })
  }

  const belowTarget = recentResults.find((q) => q.responseRate !== null && q.responseRate < BELOW_TARGET_RESPONSE_RATE)
  if (belowTarget) {
    cards.push({
      type: 'belowTarget',
      quizId: belowTarget.quizId,
      name: belowTarget.name,
      responseRate: belowTarget.responseRate,
    })
  }

  const draft = quizzes.find((q) => q.status === 'draft')
  if (draft) {
    cards.push({ type: 'draft', quizId: draft.id, name: draft.name })
  }

  return cards.slice(0, 3)
}
