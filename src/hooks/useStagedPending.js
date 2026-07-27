import { useState, useEffect } from 'react'

// Staged reassurance copy for a long-running call — no fake progress percentages, just text that
// advances on a schedule so a slow request never reads as frozen (§6.5). `stages` is an array of
// `{ afterMs, text }`; the hook returns the current stage's text while `active`, resetting to the
// first stage when inactive. Shared by GenerateQuiz (document → draft) and FirstRunFinale
// (send → simulate → results) so the idiom can't drift between them.
export function useStagedPending(active, stages) {
  const [stageText, setStageText] = useState(stages[0].text)
  useEffect(() => {
    if (!active) { setStageText(stages[0].text); return }
    const timers = stages.map((s) => setTimeout(() => setStageText(s.text), s.afterMs))
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])
  return stageText
}

export default useStagedPending
