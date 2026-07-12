import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../api'
import FEATURE_INTRO_CONTENT from '../data/featureIntros'

// One promotional card, shown at most once per session (sessionStorage — §6.9; server-side
// dismissals are still permanent). Purple-tinted background, full border, no colored accent bar
// (AI-slop blacklist #8, CEO review addendum §6.1). Exactly two actions: "Show me" navigates,
// "✕" dismisses forever via PUT /api/me/feature-intros.
function FeatureIntroCard({ introKey, onDismissed }) {
  const navigate = useNavigate()
  const content = FEATURE_INTRO_CONTENT[introKey]

  useEffect(() => {
    if (!introKey) return
    sessionStorage.setItem('qp_intro_shown_this_session', introKey)
    fetch(`${API_BASE}/me/feature-intros`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: introKey, event: 'shown' }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introKey])

  if (!introKey || !content) return null

  async function dismiss() {
    onDismissed?.()
    try {
      await fetch(`${API_BASE}/me/feature-intros`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: introKey, event: 'dismissed' }),
      })
    } catch {
      // best-effort — worst case the card reappears next session, not a correctness issue
    }
  }

  return (
    <div
      data-testid={`feature-intro-${introKey}`}
      role="status"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '14px',
        background: '#F1EFFD', border: 'var(--bw) solid var(--border)', borderRadius: '10px',
        padding: '14px 16px', marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '22px', flexShrink: 0 }} aria-hidden="true">✨</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{content.headline}</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{content.line}</div>
        <button
          type="button"
          onClick={() => { onDismissed?.(); navigate(content.route) }}
          style={{ marginTop: '10px', padding: '7px 14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Show me
        </button>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        style={{ padding: '4px 8px', background: 'transparent', border: 'none', fontSize: '15px', cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  )
}

// One-per-session helper: true if a card has already been shown this browser tab/session.
export function hasShownIntroThisSession() {
  return !!sessionStorage.getItem('qp_intro_shown_this_session')
}

export default FeatureIntroCard
