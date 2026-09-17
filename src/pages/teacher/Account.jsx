import { useState } from 'react'
import API_BASE from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import { loginRequest } from '../../authConfig'
import { setOnboarded } from '../../onboardingCache'

// Teacher self-service account deletion. Irreversible, so it needs a recent sign-in (the server
// enforces step-up re-auth) and the exact word DELETE typed in. On success the account and all its
// data are gone, so we clear the local onboarding cache and sign out.
export default function Account() {
  const { user, login, logout } = useAuth()
  const [confirm, setConfirm] = useState('')
  const [status, setStatus] = useState(null) // null | 'reauth' | 'error' | 'ratelimited'
  const [busy, setBusy] = useState(false)

  const canDelete = confirm === 'DELETE' && !busy

  async function handleDelete() {
    if (!canDelete) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm }),
      })
      if (res.status === 200) {
        setOnboarded(null) // account is gone — the next sign-in starts fresh at onboarding
        logout()
        return
      }
      let body = {}
      try { body = await res.json() } catch { /* no body */ }
      if (res.status === 401 && body.reauthRequired) {
        setStatus('reauth')
      } else if (res.status === 429) {
        setStatus('ratelimited')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    } finally {
      setBusy(false)
    }
  }

  function handleReauth() {
    // Fresh sign-in, then the teacher comes back and retries.
    login({ ...loginRequest, prompt: 'login' })
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>Your account</h1>
      {user?.email && (
        <p style={{ color: 'var(--muted)', fontSize: '14px', margin: '0 0 24px' }}>
          Signed in as <strong style={{ color: 'var(--text)' }}>{user.email}</strong>
        </p>
      )}

      <div style={{ border: 'var(--bw) solid var(--border)', background: 'var(--surface)', padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: 'var(--danger)' }}>Delete my account</h2>
        <p style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.6, margin: '0 0 12px' }}>
          This permanently removes everything on this account. It can't be undone. Deleting removes:
        </p>
        <ul style={{ fontSize: '14px', color: 'var(--text)', lineHeight: 1.7, margin: '0 0 16px', paddingLeft: '20px' }}>
          <li>Your classes and your students' names</li>
          <li>Every quiz you've built and every answer students gave</li>
          <li>Your questions, drafts and uploaded materials</li>
        </ul>

        <label htmlFor="confirm-delete" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--muted)', marginBottom: '6px' }}>
          Type DELETE to confirm
        </label>
        <input
          id="confirm-delete"
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          className="input"
          style={{ width: '100%', maxWidth: '240px', marginBottom: '16px' }}
        />

        {status === 'reauth' && (
          <div style={{ background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', padding: '12px 14px', fontSize: '13px', marginBottom: '16px' }}>
            For your security, please sign in again before deleting your account.{' '}
            <button
              type="button"
              onClick={handleReauth}
              className="btn btn-secondary"
              style={{ marginTop: '10px', fontSize: '13px' }}
            >
              Sign in again
            </button>
          </div>
        )}
        {status === 'ratelimited' && (
          <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
            Too many attempts just now. Please wait a little and try again.
          </div>
        )}
        {status === 'error' && (
          <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '16px' }}>
            Something went wrong. Please try again.
          </div>
        )}

        <button
          type="button"
          onClick={handleDelete}
          disabled={!canDelete}
          className="btn btn-primary"
          style={{ background: canDelete ? 'var(--danger)' : undefined }}
        >
          {busy ? 'Deleting…' : 'Delete my account'}
        </button>
      </div>
    </div>
  )
}
