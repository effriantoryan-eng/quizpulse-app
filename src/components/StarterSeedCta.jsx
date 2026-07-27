import { useState } from 'react'
import API_BASE from '../api'

// v4.6.0 Task 6 — "Add 5 starter questions" CTA for a teacher who quit onboarding before the
// first-run finale seeded anything. Calls the same idempotent endpoint the finale uses
// (POST /api/questions/starter-seed), so hitting this after the finale already ran is a no-op,
// not a duplicate.
function StarterSeedCta({ onSeeded }) {
  const [seeding, setSeeding] = useState(false)
  const [error, setError] = useState(null)

  async function seed() {
    setSeeding(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/questions/starter-seed`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not add starter questions — please try again.')
        return
      }
      onSeeded?.(data)
    } catch {
      setError('Could not connect to the server. Please try again.')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div style={{ marginTop: '12px' }}>
      <button
        type="button"
        data-testid="starter-seed-cta"
        onClick={seed}
        disabled={seeding}
        style={{
          padding: '9px 16px', background: 'var(--primary)', color: 'white', border: 'none',
          borderRadius: '8px', fontSize: '13px', fontWeight: 600,
          cursor: seeding ? 'default' : 'pointer', opacity: seeding ? 0.7 : 1,
        }}
      >
        {seeding ? 'Adding…' : 'Add 5 starter questions'}
      </button>
      {error && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '8px' }}>{error}</p>}
    </div>
  )
}

export default StarterSeedCta
