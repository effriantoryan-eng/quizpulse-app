// Design guard (R5) — source-level regression test.
// Fails if any .jsx file outside the AI-file allowlist contains:
//   - borderRadius literal other than '0', '0px', '50%', or var(...)
//   - boxShadow literal other than 'none' or var(...)
//   - Emoji code points in the U+1F000–U+1FFFF range

const { readdirSync, readFileSync, statSync } = require('fs')
const { join } = require('path')

// D5.4: AI generation files are excluded — they use a distinct step-by-step wizard aesthetic.
const EXCLUDED = new Set(['GenerateQuiz.jsx', 'ReviewDraft.jsx'])

function collectJsx(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) collectJsx(full, files)
    else if (entry.endsWith('.jsx') && !EXCLUDED.has(entry)) files.push(full)
  }
  return files
}

const SRC = join(__dirname, '../../src')
const files = collectJsx(SRC)

// Allow: '0' | '0px' | '50%' | var(...)
const BAD_RADIUS = /borderRadius:\s*'(?!(0(?:px)?|50%|var\()[^'])'([^']+)'/

// Allow: 'none' | var(...)
const BAD_SHADOW = /boxShadow:\s*'(?!(none|var\()[^'])'([^']+)'/

// Emoji in U+1F000–U+1FFFF (common pictographs and symbols)
const EMOJI_RE = /[\uD83C-\uDBFF][\uDC00-\uDFFF]/

describe('design guard (R5)', () => {
  for (const file of files) {
    const rel = file.replace(SRC, '').replace(/\\/g, '/')
    const src = readFileSync(file, 'utf8')

    test(`${rel}: no disallowed borderRadius literal`, () => {
      const lines = src.split('\n')
      const violations = lines.filter(l => {
        const m = l.match(/borderRadius:\s*'([^']+)'/)
        if (!m) return false
        const v = m[1]
        return v !== '0' && v !== '0px' && v !== '50%' && !v.startsWith('var(')
      })
      expect(violations).toEqual([])
    })

    test(`${rel}: no raw boxShadow literal`, () => {
      const lines = src.split('\n')
      const violations = lines.filter(l => {
        const m = l.match(/boxShadow:\s*'([^']+)'/)
        if (!m) return false
        const v = m[1]
        return v !== 'none' && !v.startsWith('var(')
      })
      expect(violations).toEqual([])
    })

    test(`${rel}: no emoji code points`, () => {
      const match = src.match(EMOJI_RE)
      expect(match).toBeNull()
    })
  }
})
