// Unit tests for src/data/confidenceTally.js — v4.7.0 T5 completion self-summary. The source is
// an ESM module (Vite-only); Jest's CJS runner can't require() it directly, so this mirrors the
// logic for isolated testing (same convention as topicPrefilter.test.js / demoNav.test.js).

function tallyConfidence(answersPayload) {
  const tally = { sure: 0, pretty_sure: 0, guessing: 0 }
  for (const a of answersPayload) {
    if (a.confidence in tally) tally[a.confidence] += 1
  }
  return tally
}

function tallySummaryText(tally) {
  const parts = []
  if (tally.sure) parts.push(`${tally.sure} sure`)
  if (tally.pretty_sure) parts.push(`${tally.pretty_sure} pretty sure`)
  if (tally.guessing) parts.push(`${tally.guessing} guessing`)
  return parts.join(' / ')
}

describe('confidenceTally', () => {
  it('counts each confidence level from the submitted answers', () => {
    const answers = [
      { questionId: '1', confidence: 'sure' },
      { questionId: '2', confidence: 'sure' },
      { questionId: '3', confidence: 'pretty_sure' },
      { questionId: '4', confidence: 'guessing' },
    ]
    expect(tallyConfidence(answers)).toEqual({ sure: 2, pretty_sure: 1, guessing: 1 })
  })

  it('ignores an unrecognised or missing confidence value rather than throwing', () => {
    expect(tallyConfidence([{ questionId: '1' }, { questionId: '2', confidence: 'bogus' }]))
      .toEqual({ sure: 0, pretty_sure: 0, guessing: 0 })
  })

  it('builds a "7 sure / 4 pretty sure / 1 guessing"-style summary, skipping zero counts', () => {
    expect(tallySummaryText({ sure: 7, pretty_sure: 4, guessing: 1 })).toBe('7 sure / 4 pretty sure / 1 guessing')
    expect(tallySummaryText({ sure: 3, pretty_sure: 0, guessing: 0 })).toBe('3 sure')
    expect(tallySummaryText({ sure: 0, pretty_sure: 0, guessing: 0 })).toBe('')
  })
})
