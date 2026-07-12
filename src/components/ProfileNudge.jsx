import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../api'

// Dashboard banner nudging a teacher who skipped the onboarding profile steps to answer them
// later. Permanently dismissible via the featureIntros.profile_nudge key. Per the design review
// (§6.2), this is the dashboard's "one promo" slot — a task-3 eligible intro card outranks it and
// the nudge simply doesn't render that render (handled by the caller passing `suppressed`).
function ProfileNudge({ suppressed = false }) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/me`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const dismissed = !!data.featureIntros?.profile_nudge?.dismissedAt
        setVisible(data.onboarded && data.profileComplete === false && !dismissed)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function dismiss() {
    setVisible(false)
    try {
      await fetch(`${API_BASE}/me/feature-intros`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'profile_nudge', event: 'dismissed' }),
      })
    } catch {
      // best-effort — worst case the nudge reappears next load, not a correctness issue
    }
  }

  if (!visible || suppressed) return null

  return (
    <div
      data-testid="profile-nudge"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        background: 'var(--surface)', border: 'var(--bw) solid var(--border)', borderRadius: '10px',
        padding: '12px 16px', marginBottom: '16px',
      }}
    >
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>Tell us what you teach</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>A few quick questions help us show your subjects first.</div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => navigate('/onboarding/profile')}
          style={{ padding: '8px 14px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
        >
          Answer now
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          style={{ padding: '8px 10px', background: 'transparent', border: 'none', fontSize: '15px', cursor: 'pointer', color: 'var(--muted)' }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default ProfileNudge
