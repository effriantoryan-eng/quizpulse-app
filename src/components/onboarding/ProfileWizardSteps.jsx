import { useState } from 'react'
import API_BASE from '../../api'

const SUBJECTS = ['Science', 'Maths', 'English', 'Humanities', 'Other']
const YEAR_LEVELS = [7, 8, 9, 10, 11, 12]
const REGISTRATION_OPTIONS = [
  { value: 'provisional', label: 'Working toward full registration' },
  { value: 'full', label: 'Already fully registered' },
  { value: 'undisclosed', label: 'Prefer not to say' },
]

const cardStyle = (selected) => ({
  padding: '12px 16px',
  borderRadius: '10px',
  border: 'var(--bw) solid var(--border)',
  background: selected ? 'var(--primary)' : 'var(--surface)',
  color: selected ? '#fff' : 'inherit',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  minHeight: '44px',
})

// Steps 2-5 of the onboarding wizard (subjects, year levels, class count + shells, registration
// status). Reused at wizard-end (inline after step 1) and standalone at /onboarding/profile
// (ProfileNudge follow-up). Every step is skippable — the primary button is never disabled, and
// "Next" on an empty selection behaves exactly like "Skip" (CEO review addendum §6.1).
function ProfileWizardSteps({ startStepNumber = 2, onDone }) {
  const [stepIndex, setStepIndex] = useState(0) // 0..3 across the four sub-steps
  const [subjects, setSubjects] = useState([])
  const [yearLevels, setYearLevels] = useState([])
  const [classCount, setClassCount] = useState('')
  const [createShells, setCreateShells] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const steps = [
    { key: 'subjects', answered: subjects.length > 0 },
    { key: 'yearLevels', answered: yearLevels.length > 0 },
    { key: 'classCount', answered: classCount !== '' },
    { key: 'registrationStatus', answered: registrationStatus !== null },
  ]

  function toggle(list, setList, value) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  async function finish() {
    setSaving(true)
    setError(null)
    const profile = {}
    if (subjects.length > 0) profile.subjects = subjects
    if (yearLevels.length > 0) profile.yearLevels = yearLevels
    if (classCount !== '') profile.classCount = Number(classCount)
    if (registrationStatus !== null) profile.registrationStatus = registrationStatus

    try {
      if (Object.keys(profile).length > 0) {
        const res = await fetch(`${API_BASE}/me/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile),
        })
        if (!res.ok) {
          // Keep answers client-side and let the teacher retry rather than losing the wizard
          // progress or re-gating onboarding.
          const data = await res.json().catch(() => ({}))
          setError(data.error || 'Could not save your answers — please try again.')
          setSaving(false)
          return
        }
      }
      if (createShells && classCount !== '') {
        await fetch(`${API_BASE}/classes/shells`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: Number(classCount) }),
        }).catch(() => {}) // best-effort — a partial/failed shell batch is not fatal to onboarding
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  function next() {
    if (stepIndex < steps.length - 1) setStepIndex(stepIndex + 1)
    else finish()
  }

  const current = steps[stepIndex]
  const stepNumber = startStepNumber + stepIndex
  const totalSteps = startStepNumber - 2 + steps.length // total across the whole wizard (5 when starting at step 2)

  return (
    <div style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '20px' }} aria-hidden="true">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <span
            key={i}
            style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: i + 1 < stepNumber ? 'var(--primary)' : i + 1 === stepNumber ? 'var(--primary)' : 'var(--border)',
              opacity: i + 1 <= stepNumber ? 1 : 0.4,
            }}
          />
        ))}
      </div>
      <p style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', marginBottom: '4px' }}>
        Step {stepNumber} of {totalSteps}
      </p>

      {current.key === 'subjects' && (
        <div data-testid="wizard-step-subjects">
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>What do you teach?</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
            We'll show your subjects first when you send quizzes.
          </p>
          <div style={{ display: 'grid', gap: '8px' }}>
            {SUBJECTS.map((s) => (
              <button key={s} type="button" style={cardStyle(subjects.includes(s))} onClick={() => toggle(subjects, setSubjects, s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {current.key === 'yearLevels' && (
        <div data-testid="wizard-step-year-levels">
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Which year levels?</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
            Helps us suggest the right topics when you send a quiz.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {YEAR_LEVELS.map((y) => (
              <button key={y} type="button" style={cardStyle(yearLevels.includes(y))} onClick={() => toggle(yearLevels, setYearLevels, y)}>
                Year {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {current.key === 'classCount' && (
        <div data-testid="wizard-step-class-count">
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>How many classes do you teach?</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
            We can set up empty classes for you now so you're ready to go.
          </p>
          <input
            data-testid="wizard-class-count-input"
            type="number"
            min={1}
            max={20}
            value={classCount}
            onChange={(e) => setClassCount(e.target.value)}
            placeholder="e.g. 4"
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: 'var(--bw) solid var(--border)', fontSize: '14px', boxSizing: 'border-box', marginBottom: '12px',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <input
              data-testid="wizard-create-shells-checkbox"
              type="checkbox"
              checked={createShells}
              onChange={(e) => setCreateShells(e.target.checked)}
            />
            Create these classes for me now
          </label>
        </div>
      )}

      {current.key === 'registrationStatus' && (
        <div data-testid="wizard-step-registration">
          <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Are you working toward full teacher registration?</h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
            This helps us show you relevant records later — never required.
          </p>
          <div style={{ display: 'grid', gap: '8px' }}>
            {REGISTRATION_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                style={cardStyle(registrationStatus === opt.value)}
                onClick={() => setRegistrationStatus(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '12px', fontWeight: 600 }}>{error}</p>}

      <button
        data-testid="wizard-next"
        type="button"
        disabled={saving}
        onClick={next}
        style={{
          width: '100%', marginTop: '20px', padding: '12px',
          background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
          borderRadius: '8px', fontSize: '14px', fontWeight: '500',
          cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Saving…' : stepIndex === steps.length - 1 ? 'Finish' : current.answered ? 'Next' : 'Skip'}
      </button>
    </div>
  )
}

export default ProfileWizardSteps
