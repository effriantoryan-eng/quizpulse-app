// Unit test for the v4.3.0 E1 follow-up-practice trigger — mirrors shouldOfferFollowUp() in
// src/pages/teacher/Analytics.jsx (§3.6: incorrect >=40% OR confident-but-incorrect >=25%, two
// independent constants).

function shouldOfferFollowUp(fourCell) {
  if (!fourCell) return false
  const total = fourCell.correctConfident + fourCell.correctUnsure + fourCell.incorrectConfident + fourCell.incorrectUnsure
  if (total === 0) return false
  const incorrectRate = (fourCell.incorrectConfident + fourCell.incorrectUnsure) / total
  const confidentIncorrectRate = fourCell.incorrectConfident / total
  return incorrectRate >= 0.4 || confidentIncorrectRate >= 0.25
}

describe('shouldOfferFollowUp', () => {
  test('fires when incorrect rate is >= 40%, regardless of confidence split', () => {
    expect(shouldOfferFollowUp({ correctConfident: 6, correctUnsure: 0, incorrectConfident: 2, incorrectUnsure: 2 })).toBe(true)
  })

  test('fires when confident-but-incorrect alone is >= 25% even with overall incorrect < 40%', () => {
    expect(shouldOfferFollowUp({ correctConfident: 5, correctUnsure: 2, incorrectConfident: 3, incorrectUnsure: 0 })).toBe(true)
  })

  test('does not fire below both thresholds', () => {
    expect(shouldOfferFollowUp({ correctConfident: 8, correctUnsure: 1, incorrectConfident: 1, incorrectUnsure: 0 })).toBe(false)
  })

  test('does not fire on zero answers', () => {
    expect(shouldOfferFollowUp({ correctConfident: 0, correctUnsure: 0, incorrectConfident: 0, incorrectUnsure: 0 })).toBe(false)
  })

  test('does not fire when fourCell is absent (manually-authored quiz with no breakdown)', () => {
    expect(shouldOfferFollowUp(null)).toBe(false)
    expect(shouldOfferFollowUp(undefined)).toBe(false)
  })

  test('exactly at the 40% incorrect boundary fires', () => {
    expect(shouldOfferFollowUp({ correctConfident: 6, correctUnsure: 0, incorrectConfident: 2, incorrectUnsure: 2 })).toBe(true) // 4/10 = 40%
  })

  test('exactly at the 25% confident-incorrect boundary fires', () => {
    expect(shouldOfferFollowUp({ correctConfident: 3, correctUnsure: 0, incorrectConfident: 1, incorrectUnsure: 0 })).toBe(true) // 1/4 = 25%
  })
})
