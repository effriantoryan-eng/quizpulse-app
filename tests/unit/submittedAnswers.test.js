// Unit tests for src/data/submittedAnswers.js (parseSubmittedAnswers) and the confidenceTrend
// addition in src/data/confidenceTally.js — v4.8 student quiz history / own-answer review. Sources
// are ESM (Vite-only); Jest's CJS runner can't require() them, so this mirrors the logic for
// isolated testing (same convention as confidenceTally.test.js / demoNav.test.js).

function parseSubmittedAnswers(raw) {
  if (!raw) return null
  let parsed
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || !Array.isArray(parsed.answers)) return null
  return { answers: parsed.answers, completedAt: parsed.completedAt || null }
}

function confidenceTrend(payloads) {
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
  if (guessRatio >= 0.5) return 'GUESS'
  if (confidentRatio >= 0.75) return 'SURE'
  return 'MIX'
}

describe('parseSubmittedAnswers', () => {
  it('parses the new-shape payload', () => {
    const raw = JSON.stringify({ answers: [{ questionId: 'q1', selectedIndex: 2, confidence: 'sure' }], completedAt: '2026-08-23T00:00:00Z' })
    const out = parseSubmittedAnswers(raw)
    expect(out).not.toBeNull()
    expect(out.answers).toHaveLength(1)
    expect(out.completedAt).toBe('2026-08-23T00:00:00Z')
  })

  it('returns null for the legacy "1" flag — JSON.parse("1") is 1 and does NOT throw', () => {
    // This is the trap: a bare "1" is valid JSON, so only the shape guard catches it.
    expect(JSON.parse('1')).toBe(1) // documents the trap
    expect(parseSubmittedAnswers('1')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseSubmittedAnswers('{not json')).toBeNull()
  })

  it('returns null for valid JSON of the wrong shape', () => {
    expect(parseSubmittedAnswers(JSON.stringify({ foo: 'bar' }))).toBeNull()
    expect(parseSubmittedAnswers(JSON.stringify({ answers: 'nope' }))).toBeNull()
  })

  it('returns null for empty / missing input', () => {
    expect(parseSubmittedAnswers(null)).toBeNull()
    expect(parseSubmittedAnswers('')).toBeNull()
  })

  it('tolerates a missing completedAt', () => {
    const out = parseSubmittedAnswers(JSON.stringify({ answers: [] }))
    expect(out).toEqual({ answers: [], completedAt: null })
  })
})

describe('confidenceTrend', () => {
  const p = (...confs) => ({ answers: confs.map((c, i) => ({ questionId: `q${i}`, confidence: c })) })

  it('returns null below 2 quizzes (nothing honest to say yet)', () => {
    expect(confidenceTrend([])).toBeNull()
    expect(confidenceTrend([p('sure', 'sure')])).toBeNull()
  })

  it('returns null when there are 2+ quizzes but no confidence data', () => {
    expect(confidenceTrend([{ answers: [] }, { answers: [] }])).toBeNull()
  })

  it('flags a guessing-heavy stretch (>= 50% guessing)', () => {
    expect(confidenceTrend([p('guessing', 'guessing'), p('guessing', 'sure')])).toBe('GUESS')
  })

  it('flags a confident stretch (>= 75% sure/pretty_sure)', () => {
    expect(confidenceTrend([p('sure', 'sure'), p('pretty_sure', 'sure')])).toBe('SURE')
  })

  it('falls back to a mixed message otherwise (< 50% guessing, < 75% confident)', () => {
    // 5 answers: 3 confident (60%), 2 guessing (40%) — neither threshold trips.
    expect(confidenceTrend([p('sure', 'sure', 'guessing'), p('pretty_sure', 'guessing')])).toBe('MIX')
  })
})
