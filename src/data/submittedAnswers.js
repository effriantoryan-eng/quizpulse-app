// Device-local record of a student's own submitted answers, so they can review them later
// (own choices + confidence, never a score). The answers live on the device that made them —
// same posture as v4.7.0's confidence self-summary, which reads the submitted payload rather
// than a new query. No endpoint, no server round-trip.

const PREFIX = 'quizpulse_submitted_'
export const submittedKey = (quizId) => `${PREFIX}${quizId}`

// Persist the just-submitted answers. BOTH TakeQuiz submit paths call this so the stored shape
// can't drift between them (this repo has been bitten by copy-paste drift before — the
// rateLimit-import regression). Non-fatal on failure: the submission itself already succeeded.
export function saveSubmitted(quizId, answersPayload) {
  try {
    localStorage.setItem(submittedKey(quizId), JSON.stringify({
      answers: answersPayload,
      completedAt: new Date().toISOString(),
    }))
  } catch {
    // localStorage full/blocked — swallow. Review just won't have this one; nothing else breaks.
  }
}

// Returns { answers, completedAt } or null. null covers: nothing stored, the legacy '1' flag
// (pre-v4.8 devices stored a bare '1' here), malformed JSON, and valid-JSON-wrong-shape.
// IMPORTANT: JSON.parse('1') === 1 and does NOT throw — so the Array.isArray shape guard, not
// the try/catch, is what actually catches the legacy value. Do not "simplify" the guard away.
export function parseSubmittedAnswers(raw) {
  if (!raw) return null
  let parsed
  try { parsed = JSON.parse(raw) } catch { return null }
  if (!parsed || !Array.isArray(parsed.answers)) return null
  return { answers: parsed.answers, completedAt: parsed.completedAt || null }
}

export function readSubmitted(quizId) {
  return parseSubmittedAnswers(localStorage.getItem(submittedKey(quizId)))
}

// Scan every saved submission on this device (across all quizzes) — feeds the E1 trend strip.
export function gatherSubmittedPayloads() {
  const out = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) {
      const p = parseSubmittedAnswers(localStorage.getItem(k))
      if (p) out.push(p)
    }
  }
  return out
}
