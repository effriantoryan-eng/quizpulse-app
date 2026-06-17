// Unit tests for src/data/encouragements.js + the selection logic used in TakeQuiz.
//
// The data file uses ESM (export default), which Jest's CJS runner can't require() directly.
// We read and parse it as text — a standard pattern for data-only files in this repo.

const fs   = require('fs')
const path = require('path')

// Parse the array literal from the JS source file.
function parseEncouragements() {
  const src = fs.readFileSync(
    path.join(__dirname, '../../src/data/encouragements.js'),
    'utf8'
  )
  // Match every single-quoted string that is a list element (preceded by newline + spaces).
  // This avoids matching the variable name or variable keywords.
  const matches = src.match(/^\s+'([^'\\]|\\.)*'/gm) || []
  return matches.map(m => m.trim().slice(1, -1).replace(/\\'/g, "'"))
}

describe('ENCOURAGEMENTS data', () => {
  let lines

  beforeAll(() => {
    lines = parseEncouragements()
  })

  test('has exactly 10 entries', () => {
    expect(lines).toHaveLength(10)
  })

  test('every entry is a non-empty plain-text string', () => {
    for (const line of lines) {
      expect(typeof line).toBe('string')
      expect(line.trim().length).toBeGreaterThan(0)
      // No HTML markup
      expect(line).not.toMatch(/<[a-z]/i)
    }
  })

  test('all entries are effort/participation-focused, not ability-focused', () => {
    const abilityWords = /\b(smart|clever|intelligent|genius|bright|gifted|talented|correct|right answer|scored)\b/i
    for (const line of lines) {
      expect(line).not.toMatch(abilityWords)
    }
  })
})

describe('encouragement selection logic', () => {
  // Mirrors the useMemo in TakeQuiz: Math.floor(Math.random() * ENCOURAGEMENTS.length)
  function pickOne(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
  }

  test('returns an item that is in the array', () => {
    const arr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const result = pickOne(arr)
    expect(arr).toContain(result)
  })

  test('never returns undefined for a 10-item array', () => {
    const arr = Array.from({ length: 10 }, (_, i) => `item-${i}`)
    for (let i = 0; i < 50; i++) {
      expect(pickOne(arr)).toBeDefined()
    }
  })

  test('selects a valid encouragement from the real data', () => {
    const lines = parseEncouragements()
    const result = pickOne(lines)
    expect(lines).toContain(result)
    expect(result.length).toBeGreaterThan(0)
  })
})
