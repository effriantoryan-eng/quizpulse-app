// Unit tests for src/hooks/useRouteFocus.js — mirrors the pure exported function
// (same convention as schoolHours.test.js / confidenceTally.test.js: Jest CJS runner,
// no ESM imports, logic copied verbatim).

function shouldMoveFocus(prev, next) {
  return prev !== next
}

describe('shouldMoveFocus', () => {
  test('returns true when path changes', () => {
    expect(shouldMoveFocus('/teacher/home', '/teacher/classes')).toBe(true)
  })
  test('returns false when path is the same', () => {
    expect(shouldMoveFocus('/teacher/home', '/teacher/home')).toBe(false)
  })
  test('returns true on initial mount from empty string', () => {
    expect(shouldMoveFocus('', '/login')).toBe(true)
  })
})
