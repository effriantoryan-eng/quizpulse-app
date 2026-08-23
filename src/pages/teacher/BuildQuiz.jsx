import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import FeatureIntroCard, { hasShownIntroThisSession } from '../../components/FeatureIntroCard'
import StarterSeedCta from '../../components/StarterSeedCta'
import API_BASE from '../../api'

const TOPIC_COLORS = {
  Science: { bg: '#E1F5EE', color: '#085041' },
  History: { bg: '#FAEEDA', color: '#633806' },
  Mathematics: { bg: '#E6F1FB', color: '#0C447C' },
  English: { bg: '#FBEAF0', color: '#4B1528' },
  Geography: { bg: 'var(--surface2)', color: 'var(--text)' },
}

function BuildQuiz() {
  const { teacherId, login } = useAuth()
  const navigate = useNavigate()
  const [hintVisible, dismissHint, showHint] = useHint('build')
  const [quizName, setQuizName] = useState('')
  const [allQuestions, setAllQuestions] = useState([])
  const [selected, setSelected] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [communityIntro, setCommunityIntro] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // v4.6.0 Task 5 — persist the quiz as a real status:'draft' doc and hand off by quizId (URL,
  // survives a refresh) instead of router state (in-memory, lost on refresh/detour). SendQuiz
  // already knows how to resume from a quizId — this reuses that same v4.3 "quizId mode" path
  // rather than adding a second load mechanism.
  async function saveAndGoToSend() {
    setSavingDraft(true)
    setSaveError(null)
    try {
      const res = await fetch(`${API_BASE}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: quizName.trim(), questionIds: selected.map((q) => q.id) }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error || 'Could not save this quiz — please try again.')
        return
      }
      navigate(`/teacher/send?quizId=${data.id}`)
    } catch {
      setSaveError('Could not connect to the server. Please try again.')
    } finally {
      setSavingDraft(false)
    }
  }

  useEffect(() => {
    if (hasShownIntroThisSession()) return
    fetch(`${API_BASE}/me`)
      .then((r) => r.json())
      .then((data) => setCommunityIntro((data.eligibleIntros || []).includes('community_intro')))
      .catch(() => {})
  }, [])

  async function fetchQuestions() {
    setLoading(true)
    setError(null)
    setSessionExpired(false)
    try {
      const res = await fetch(`${API_BASE}/questions?teacherId=${teacherId}`)
      if (res.status === 401) { setSessionExpired(true); return }
      if (!res.ok) throw new Error('Something went wrong loading your questions.')
      const data = await res.json()
      setAllQuestions(data)
      setSelected(data)
      setPreviewIndex(0)
    } catch {
      setError('Something went wrong loading your questions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!teacherId) return
    fetchQuestions()
  }, [teacherId])

  function moveUp(index) {
    if (index === 0) return
    const updated = [...selected]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setSelected(updated)
    if (previewIndex === index) setPreviewIndex(index - 1)
  }

  function moveDown(index) {
    if (index === selected.length - 1) return
    const updated = [...selected]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    setSelected(updated)
    if (previewIndex === index) setPreviewIndex(index + 1)
  }

  function removeQuestion(id) {
    setSelected(prev => prev.filter(q => q.id !== id))
    setPreviewIndex(0)
  }

  const previewQuestion = selected[previewIndex]

  if (loading) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px', color: '#888', fontSize: '14px' }}>
        Loading questions…
      </div>
    )
  }

  if (sessionExpired) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>Your session has ended. Sign in again to continue.</p>
        <button
          onClick={() => login()}
          style={{ padding: '8px 16px', background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
        >
          Sign in
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#c0392b', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
        <button
          onClick={fetchQuestions}
          style={{ padding: '8px 16px', background: 'white', color: 'var(--primary)', border: 'var(--bw) solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ margin: 0 }}>Build quiz</h2>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'none', border: 'var(--bw) solid var(--border)', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: 'var(--primary)', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Select the questions to include, reorder them using the arrows, give your quiz a name, then click Proceed to Send."
          onDismiss={dismissHint}
        />
      )}
      {communityIntro && <FeatureIntroCard introKey="community_intro" onDismissed={() => setCommunityIntro(false)} />}

      {/* v4.3.0 E6 — persistent generation CTA, complementing the one-time ai_generation_intro
          card. Never a third banner: this is the drafts section's permanent header action. */}
      <div
        data-testid="build-generate-cta"
        onClick={() => navigate('/teacher/generate')}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px',
          background: '#E8F1FB', border: '1px solid #2C6BAA', borderRadius: '10px',
          marginBottom: '20px', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '20px' }}>🤖</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#123A5C' }}>Have a document? Draft a quiz from it</div>
          <div style={{ fontSize: '12px', color: '#2C6BAA' }}>Upload a PDF, Word doc, or text file and review AI-drafted questions.</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

        {/* Left — quiz details and questions */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>Quiz name</label>
            <input
              type="text"
              value={quizName}
              placeholder="e.g. Week 4 — Photosynthesis check-in"
              onChange={e => setQuizName(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '16px', marginBottom: '10px' }}>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '10px' }}>
              Selected questions ({selected.length})
            </div>

            {selected.length === 0 && (
              <div style={{ fontSize: '13px', color: '#aaa', padding: '16px', textAlign: 'center', border: '1px dashed #ddd', borderRadius: '8px' }}>
                No questions added yet
                {allQuestions.length === 0 && (
                  <StarterSeedCta onSeeded={(seeded) => { setAllQuestions(seeded); setSelected(seeded) }} />
                )}
              </div>
            )}

            {selected.map((q, i) => {
              const topicStyle = TOPIC_COLORS[q.topic] || { bg: 'var(--surface2)', color: 'var(--text)' }
              return (
                <div
                  key={q.id}
                  onClick={() => setPreviewIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    marginBottom: '8px',
                    border: `1px solid ${previewIndex === i ? 'var(--primary)' : '#e0e0e0'}`,
                    borderRadius: '8px',
                    background: previewIndex === i ? 'var(--surface2)22' : 'white',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#666', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, lineHeight: '1.4' }}>{q.text}</span>
                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: topicStyle.bg, color: topicStyle.color, flexShrink: 0 }}>{q.topic}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button onClick={e => { e.stopPropagation(); moveUp(i) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#888', padding: '1px 4px' }}>▲</button>
                    <button onClick={e => { e.stopPropagation(); moveDown(i) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#888', padding: '1px 4px' }}>▼</button>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeQuestion(q.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#ccc', padding: '2px 6px' }}>×</button>
                </div>
              )
            })}

            <div
              style={{ border: '1px dashed #ddd', borderRadius: '8px', padding: '12px', textAlign: 'center', fontSize: '13px', color: '#aaa', cursor: 'pointer', marginTop: '4px' }}
              onClick={() => navigate('/teacher/bank')}
            >
              + Add more from bank
            </div>
          </div>
        </div>

        {/* Right — preview */}
        <div>
          <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '10px' }}>
            Preview — student view
          </div>
          <div style={{ background: '#f8f8f8', borderRadius: '12px', padding: '16px', border: 'var(--bw) solid var(--border)' }}>
            {previewQuestion ? (
              <>
                <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', marginBottom: '10px' }}>
                  Question {previewIndex + 1} of {selected.length}
                </div>
                <div style={{ background: 'white', borderRadius: '8px', padding: '14px', marginBottom: '12px', fontSize: '14px', lineHeight: '1.5' }}>
                  {previewQuestion.text}
                </div>
                {(previewQuestion.options || []).map((opt, i) => (
                  <div key={i} style={{ background: i === previewQuestion.correctIndex ? 'var(--surface2)' : 'white', border: `1px solid ${i === previewQuestion.correctIndex ? 'var(--primary)' : '#eee'}`, borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontSize: '13px', color: i === previewQuestion.correctIndex ? 'var(--text)' : '#333' }}>
                    {opt}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', padding: '24px' }}>No questions to preview</div>
            )}
          </div>

          <button
            disabled={selected.length === 0 || !quizName.trim() || savingDraft}
            style={{ width: '100%', marginTop: '16px', padding: '12px', background: selected.length === 0 || !quizName.trim() || savingDraft ? '#ccc' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: selected.length === 0 || !quizName.trim() || savingDraft ? 'not-allowed' : 'pointer' }}
            onClick={saveAndGoToSend}
          >
            {savingDraft ? 'Saving…' : 'Save & go to send →'}
          </button>
          {saveError && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '8px' }}>{saveError}</p>}
        </div>
      </div>
    </div>
  )
}

export default BuildQuiz
