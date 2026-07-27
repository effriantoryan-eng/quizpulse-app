import { useState, useEffect } from 'react'
import API_BASE from '../api'
import FeatureIntroCard, { hasShownIntroThisSession } from './FeatureIntroCard'
import ProfileNudge from './ProfileNudge'

function pickIntro(eligibleIntros, excludeKey) {
  const candidates = (eligibleIntros || []).filter((k) => k !== 'community_intro' && k !== excludeKey)
  return candidates.length > 0 && !hasShownIntroThisSession() ? candidates[0] : null
}

// The dashboard's single promotional slot (CEO review addendum §6.2 "max ONE promotional
// element per page render"): an eligible feature-intro card outranks ProfileNudge, which waits.
// `excludeKey` lets a page opt a key out of this slot when it renders that card itself elsewhere
// (BuildQuiz shows community_intro as its own header/empty-state action, never here).
// `eligibleIntros` lets a page that already fetched /api/me (e.g. TeacherHome, for the getting-
// started checklist) pass the array in so PromoSlot doesn't re-fetch /api/me; omit it and
// PromoSlot fetches for itself.
function PromoSlot({ excludeKey, eligibleIntros } = {}) {
  const [introKey, setIntroKey] = useState(
    () => (eligibleIntros !== undefined ? pickIntro(eligibleIntros, excludeKey) : undefined),
  ) // undefined = loading, null = none eligible

  useEffect(() => {
    if (eligibleIntros !== undefined) {
      setIntroKey(pickIntro(eligibleIntros, excludeKey))
      return
    }
    let cancelled = false
    fetch(`${API_BASE}/me`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setIntroKey(pickIntro(data.eligibleIntros, excludeKey)) })
      .catch(() => { if (!cancelled) setIntroKey(null) })
    return () => { cancelled = true }
  }, [excludeKey, eligibleIntros])

  if (introKey === undefined) return null
  if (introKey) return <FeatureIntroCard introKey={introKey} onDismissed={() => setIntroKey(null)} />
  return <ProfileNudge />
}

export default PromoSlot
