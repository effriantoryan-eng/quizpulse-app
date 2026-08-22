// Unit tests for src/data/alsoWaiting.js — v4.7.0 T1 "Also waiting" card derivation. Mirrors the
// ESM source (Jest CJS can't require() it) per the house convention (topicPrefilter.test.js).

const BELOW_TARGET_RESPONSE_RATE = 60

function buildAlsoWaitingCards({ activeQuizzes = [], recentResults = [], quizzes = [] }) {
  const cards = []

  const nonSubmitter = activeQuizzes.find((q) => q.classSize > 0 && q.totalResponses < q.classSize)
  if (nonSubmitter) {
    cards.push({
      type: 'nonSubmitters', quizId: nonSubmitter.quizId, name: nonSubmitter.name,
      count: nonSubmitter.classSize - nonSubmitter.totalResponses, total: nonSubmitter.classSize,
    })
  }

  const belowTarget = recentResults.find((q) => q.responseRate !== null && q.responseRate < BELOW_TARGET_RESPONSE_RATE)
  if (belowTarget) {
    cards.push({ type: 'belowTarget', quizId: belowTarget.quizId, name: belowTarget.name, responseRate: belowTarget.responseRate })
  }

  const draft = quizzes.find((q) => q.status === 'draft')
  if (draft) cards.push({ type: 'draft', quizId: draft.id, name: draft.name })

  return cards.slice(0, 3)
}

describe('buildAlsoWaitingCards', () => {
  it('returns empty for a brand-new teacher with no data', () => {
    expect(buildAlsoWaitingCards({})).toEqual([])
  })

  it('surfaces a non-submitter card for an open quiz with unanswered roster spots', () => {
    const cards = buildAlsoWaitingCards({
      activeQuizzes: [{ quizId: 'q1', name: 'Forces Recap', classSize: 31, totalResponses: 25 }],
    })
    expect(cards).toEqual([{ type: 'nonSubmitters', quizId: 'q1', name: 'Forces Recap', count: 6, total: 31 }])
  })

  it('skips the non-submitter card once everyone has answered', () => {
    const cards = buildAlsoWaitingCards({
      activeQuizzes: [{ quizId: 'q1', name: 'Done Quiz', classSize: 10, totalResponses: 10 }],
    })
    expect(cards).toEqual([])
  })

  it('surfaces a below-target card for a closed quiz under the response-rate proxy threshold', () => {
    const cards = buildAlsoWaitingCards({
      recentResults: [{ quizId: 'q2', name: 'Mole Calculations', responseRate: 48 }],
    })
    expect(cards).toEqual([{ type: 'belowTarget', quizId: 'q2', name: 'Mole Calculations', responseRate: 48 }])
  })

  it('does not surface a below-target card at or above the threshold', () => {
    const cards = buildAlsoWaitingCards({ recentResults: [{ quizId: 'q2', name: 'Fine Quiz', responseRate: 60 }] })
    expect(cards).toEqual([])
  })

  it('surfaces a draft-in-progress card from the teacher\'s quiz list', () => {
    const cards = buildAlsoWaitingCards({ quizzes: [{ id: 'q3', name: 'Genetics Unit Test', status: 'draft' }] })
    expect(cards).toEqual([{ type: 'draft', quizId: 'q3', name: 'Genetics Unit Test' }])
  })

  it('caps at 3 cards, one per type, in priority order', () => {
    const cards = buildAlsoWaitingCards({
      activeQuizzes: [{ quizId: 'q1', name: 'A', classSize: 10, totalResponses: 4 }],
      recentResults: [{ quizId: 'q2', name: 'B', responseRate: 10 }],
      quizzes: [{ id: 'q3', name: 'C', status: 'draft' }, { id: 'q4', name: 'D', status: 'draft' }],
    })
    expect(cards).toHaveLength(3)
    expect(cards.map((c) => c.type)).toEqual(['nonSubmitters', 'belowTarget', 'draft'])
  })
})
