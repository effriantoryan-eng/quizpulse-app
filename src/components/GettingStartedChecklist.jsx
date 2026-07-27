import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../api'

// v4.6.0 Task 4 — renders `gettingStarted` from GET /api/me (computed server-side in
// api/shared/gettingStarted.js). `variant="full"` is the active card that owns PromoSlot's spot
// on Home until released/dismissed; `variant="strip"` is the post-release collapsed strip at the
// bottom of Home. Both read the same `gettingStarted` prop — TeacherHome fetches it once and
// decides which variant(s) to render.

const STEP_LABELS = {
  'practice-quiz-sent': 'Send your practice quiz',
  'results-seen': 'See the results come in',
  'real-class-created': 'Create a real class',
  'join-code-shared': 'Share your join code',
  'first-real-send': 'Send your first real quiz',
}
// Where clicking an un-done step takes the teacher. The first two are satisfied automatically by
// the first-run finale, so they're not independently actionable here.
const STEP_ROUTES = {
  'real-class-created': '/teacher/classes',
  'join-code-shared': '/teacher/classes',
  'first-real-send': '/teacher/build',
}

async function putFeatureIntro(body) {
  return fetch(`${API_BASE}/me/feature-intros`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function StepRow({ step, index, skipped, onNavigate, onSkip }) {
  const clickable = !step.done && STEP_ROUTES[step.key]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0' }}>
      <span
        aria-hidden="true"
        style={{
          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700,
          background: step.done ? 'var(--primary)' : 'transparent',
          border: step.done ? 'none' : '1.5px solid var(--border)',
          color: step.done ? '#fff' : 'var(--muted)',
        }}
      >
        {step.done ? '✓' : index + 1}
      </span>
      <button
        type="button"
        disabled={!clickable}
        onClick={() => clickable && onNavigate(STEP_ROUTES[step.key])}
        style={{
          flex: 1, textAlign: 'left', background: 'transparent', border: 'none', padding: 0,
          fontSize: '13px', fontWeight: step.done ? 400 : 600,
          color: step.done ? 'var(--muted)' : 'inherit',
          textDecoration: step.done ? 'line-through' : 'none',
          cursor: clickable ? 'pointer' : 'default',
        }}
      >
        {STEP_LABELS[step.key]}{skipped && !step.done ? ' — skipped' : ''}
      </button>
      {!step.done && !skipped && onSkip && (
        <button
          type="button"
          onClick={() => onSkip(step.key)}
          style={{ fontSize: '11px', color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          Skip
        </button>
      )}
    </div>
  )
}

function GettingStartedChecklist({ gettingStarted, variant, onChange }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const steps = gettingStarted.steps || []
  const skippedSteps = gettingStarted.skippedSteps || []
  const doneCount = steps.filter((s) => s.done).length

  async function dismiss() {
    onChange?.({ ...gettingStarted, dismissed: true })
    try { await putFeatureIntro({ key: 'getting_started', event: 'dismissed' }) } catch { /* best-effort */ }
  }

  async function skipStep(stepKey) {
    onChange?.({ ...gettingStarted, skippedSteps: [...skippedSteps, stepKey] })
    try { await putFeatureIntro({ key: 'getting_started', event: 'skip-step', step: stepKey }) } catch { /* best-effort */ }
  }

  if (steps.length === 0) return null

  if (variant === 'strip') {
    return (
      <div style={{ marginTop: '24px' }}>
        <button
          type="button"
          data-testid="getting-started-strip"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          style={{
            width: '100%', textAlign: 'left', padding: '10px 14px',
            background: '#F1EFFD', border: 'var(--bw) solid var(--border)', borderRadius: '10px',
            fontSize: '13px', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer',
          }}
        >
          Getting started: {doneCount} of {steps.length} {expanded ? '▾' : '▸'}
        </button>
        {expanded && (
          <div style={{ marginTop: '8px', padding: '10px 14px', background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '10px' }}>
            {steps.map((step, i) => (
              <StepRow key={step.key} step={step} index={i} skipped={skippedSteps.includes(step.key)} onNavigate={navigate} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-testid="getting-started-checklist" style={{ background: '#F1EFFD', border: 'var(--bw) solid var(--border)', borderRadius: '10px', padding: '16px 18px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>Getting started</div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          style={{ padding: '2px 6px', background: 'transparent', border: 'none', fontSize: '15px', cursor: 'pointer', color: 'var(--muted)' }}
        >
          ✕
        </button>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'var(--surface2)', marginBottom: '14px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(doneCount / steps.length) * 100}%`, background: 'var(--primary)' }} />
      </div>
      {steps.map((step, i) => (
        <StepRow
          key={step.key}
          step={step}
          index={i}
          skipped={skippedSteps.includes(step.key)}
          onNavigate={navigate}
          onSkip={skipStep}
        />
      ))}
    </div>
  )
}

export default GettingStartedChecklist
