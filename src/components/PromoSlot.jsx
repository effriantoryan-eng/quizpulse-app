import { useState, useEffect } from 'react'
import API_BASE from '../api'
import FeatureIntroCard, { hasShownIntroThisSession } from './FeatureIntroCard'
import ProfileNudge from './ProfileNudge'

// The dashboard's single promotional slot (CEO review addendum §6.2 "max ONE promotional
// element per page render"): an eligible feature-intro card outranks ProfileNudge, which waits.
// `excludeKey` lets a page opt a key out of this slot when it renders that card itself elsewhere
// (BuildQuiz shows community_intro as its own header/empty-state action, never here).
function PromoSlot({ excludeKey } = {}) {
  const [introKey, setIntroKey] = useState(undefined) // undefined = loading, null = none eligible

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/me`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const candidates = (data.eligibleIntros || []).filter((k) => k !== 'community_intro' && k !== excludeKey)
        const picked = candidates.length > 0 && !hasShownIntroThisSession() ? candidates[0] : null
        setIntroKey(picked)
      })
      .catch(() => { if (!cancelled) setIntroKey(null) })
    return () => { cancelled = true }
  }, [excludeKey])

  if (introKey === undefined) return null
  if (introKey) return <FeatureIntroCard introKey={introKey} onDismissed={() => setIntroKey(null)} />
  return <ProfileNudge />
}

export default PromoSlot
