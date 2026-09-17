import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import API_BASE from '../../api'
import AiBadge from '../../components/AiBadge'

const MIN_QUESTIONS = 3
const MAX_SCHEDULE_ENTRIES = 5
const DEFAULT_SCHEDULE = [2, 7, 21]

function QuestionCard({ question, index, onTick, onEdit, onDelete, onRegenerate, deleteDisabled, regenerating }) {
  const [editing, setEditing] = useState(false)
  const [draftText, setDraftText] = useState(question.text)
  const [draftOptions, setDraftOptions] = useState(question.options)
  const [draftCorrect, setDraftCorrect] = useState(question.correctIndex)

  function saveEdit() {
    onEdit(index, { text: draftText, options: draftOptions, correctIndex: draftCorrect })
    setEditing(false)
  }

  return (
    <div
      data-testid={`draft-question-${index}`}
      style={{
        background: question.reviewed ? '#EAF7F1' : 'white',
        border: `2px solid ${question.reviewed ? '#1a7a5e' : '#e0e0e0'}`,
        borderRadius: '10px', padding: '16px', marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', color: '#aaa' }}>
          Question {index + 1}
          {question.editedManually && <span style={{ marginLeft: '6px', color: '#1a7a5e' }}>✓ Edited</span>}
        </div>
        {question.reviewed && <span style={{ fontSize: '11px', color: '#1a7a5e', fontWeight: '600' }}>✓</span>}
      </div>

      {editing ? (
        <>
          <textarea
            value={draftText}
            onChange={e => setDraftText(e.target.value)}
            rows={2}
            style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '8px', boxSizing: 'border-box' }}
          />
          {draftOptions.map((opt, oi) => (
            <div key={oi} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <input
                type="radio"
                checked={draftCorrect === oi}
                onChange={() => setDraftCorrect(oi)}
              />
              <input
                value={opt}
                onChange={e => {
                  const next = draftOptions.slice()
                  next[oi] = e.target.value
                  setDraftOptions(next)
                }}
                style={{ flex: 1, padding: '6px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button onClick={saveEdit} style={{ padding: '6px 14px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>{question.text}</div>
          {question.options.map((opt, oi) => (
            <div key={oi} style={{ fontSize: '13px', padding: '6px 10px', marginBottom: '4px', borderRadius: '6px', background: oi === question.correctIndex ? '#EAF7F1' : '#f8f8f8', color: oi === question.correctIndex ? '#1a7a5e' : '#333' }}>
              {oi === question.correctIndex ? '✓ ' : ''}{opt}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button
              data-testid={`draft-tick-${index}`}
              onClick={() => onTick(index)}
              style={{ padding: '6px 14px', background: question.reviewed ? '#1a7a5e' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
            >
              {question.reviewed ? '✓ Looks good' : 'Looks good'}
            </button>
            <button onClick={() => setEditing(true)} style={{ padding: '6px 14px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
            <button
              data-testid={`draft-regenerate-${index}`}
              onClick={() => onRegenerate(index)}
              disabled={regenerating}
              style={{ padding: '6px 14px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: regenerating ? 'not-allowed' : 'pointer', opacity: regenerating ? 0.5 : 1 }}
            >
              {regenerating ? 'Regenerating…' : 'Regenerate this one'}
            </button>
            <button
              data-testid={`draft-delete-${index}`}
              onClick={() => onDelete(index)}
              disabled={deleteDisabled}
              title={deleteDisabled ? `A quiz needs at least ${MIN_QUESTIONS} questions` : undefined}
              style={{ padding: '6px 14px', background: 'white', border: '1px solid #ddd', borderRadius: '6px', fontSize: '12px', cursor: deleteDisabled ? 'not-allowed' : 'pointer', opacity: deleteDisabled ? 0.4 : 1, marginLeft: 'auto' }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ReviewDraft() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [regeneratingIndex, setRegeneratingIndex] = useState(null)
  const [schedule, setSchedule] = useState(DEFAULT_SCHEDULE)
  const [approving, setApproving] = useState(false)
  const [approveError, setApproveError] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/generation/drafts/${id}`)
      .then(r => r.json().then(body => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) { setError(body.error || 'Draft not found'); return }
        setDraft(body)
      })
      .catch(() => setError('Draft not found'))
      .finally(() => setLoading(false))
  }, [id])

  async function persist(updatedQuestions) {
    setDraft(prev => ({ ...prev, questions: updatedQuestions }))
    await fetch(`${API_BASE}/generation/drafts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions: updatedQuestions }),
    }).catch(() => {})
  }

  function handleTick(index) {
    const next = draft.questions.map((q, i) => i === index ? { ...q, reviewed: !q.reviewed } : q)
    persist(next)
  }

  function handleEdit(index, edited) {
    const next = draft.questions.map((q, i) => i === index ? { ...q, ...edited, reviewed: true, editedManually: true } : q)
    persist(next)
  }

  function handleDelete(index) {
    if (draft.questions.length <= MIN_QUESTIONS) return
    const next = draft.questions.filter((_, i) => i !== index)
    persist(next)
  }

  async function handleRegenerate(index) {
    setRegeneratingIndex(index)
    try {
      const res = await fetch(`${API_BASE}/generation/drafts/${id}/regenerate-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionIndex: index }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.')
      const next = draft.questions.map((q, i) => i === index ? body.question : q)
      setDraft(prev => ({ ...prev, questions: next }))
    } catch (err) {
      setApproveError(err.message)
    } finally {
      setRegeneratingIndex(null)
    }
  }

  function updateScheduleEntry(i, value) {
    const next = schedule.slice()
    next[i] = Number(value)
    setSchedule(next)
  }
  function addScheduleEntry() {
    if (schedule.length >= MAX_SCHEDULE_ENTRIES) return
    setSchedule([...schedule, 7])
  }
  function removeScheduleEntry(i) {
    setSchedule(schedule.filter((_, si) => si !== i))
  }

  const allReviewed = draft?.questions.every(q => q.reviewed) ?? false
  const reviewedCount = draft?.questions.filter(q => q.reviewed).length ?? 0

  async function handleApprove() {
    setApproveError(null)
    setApproving(true)
    try {
      const res = await fetch(`${API_BASE}/generation/drafts/${id}/approve`, { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.')
      // Approve → send bridge (§6.4): straight to SendQuiz in quizId mode, schedule carried over.
      navigate('/teacher/send', { state: { quizId: body.quizId, spacedRepeats: schedule } })
    } catch (err) {
      setApproveError(err.message)
    } finally {
      setApproving(false)
    }
  }

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: '#888' }}>Loading…</div>
  if (error || !draft) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px', textAlign: 'center' }}>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '16px' }}>{error || 'Draft not found'}</p>
        <button onClick={() => navigate('/teacher/generate')} style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          Back to drafts
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px', paddingBottom: '100px' }}>
      <button
        onClick={() => navigate('/teacher/generate')}
        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, padding: 0, marginBottom: '16px' }}
      >
        ← Back to upload
      </button>
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', background: '#E8F1FB', border: '1px solid #2C6BAA', borderRadius: '8px', marginBottom: '16px' }}>
        <AiBadge />
        <span style={{ fontSize: '13px', color: '#123A5C' }}>
          These questions were created by AI from your document. Check each one before using it.
        </span>
      </div>

      <h2 style={{ marginBottom: '20px' }}>Review draft</h2>

      {draft.questions.map((q, i) => (
        <QuestionCard
          key={i}
          question={q}
          index={i}
          onTick={handleTick}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRegenerate={handleRegenerate}
          deleteDisabled={draft.questions.length <= MIN_QUESTIONS}
          regenerating={regeneratingIndex === i}
        />
      ))}

      <div style={{ background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '10px', padding: '16px', marginTop: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
          After you send this quiz, we'll resend practice on:
        </div>
        {schedule.map((days, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <input
              type="number" min={1} max={365} value={days}
              onChange={e => updateScheduleEntry(i, e.target.value)}
              style={{ width: '70px', padding: '6px 8px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '6px' }}
            />
            <span style={{ fontSize: '12px', color: '#888' }}>days</span>
            <button onClick={() => removeScheduleEntry(i)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
          </div>
        ))}
        {schedule.length < MAX_SCHEDULE_ENTRIES && (
          <button onClick={addScheduleEntry} style={{ background: 'none', border: '1px dashed #ccc', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}>
            + Add repeat
          </button>
        )}
      </div>

      {approveError && (
        <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginTop: '16px' }}>
          {approveError}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, background: 'white', borderTop: '1px solid #eee', padding: '14px 0', marginTop: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px', textAlign: 'center' }}>
          {reviewedCount} of {draft.questions.length} reviewed — tick or edit each question to approve
        </div>
        <button
          data-testid="draft-approve-button"
          disabled={!allReviewed || approving}
          onClick={handleApprove}
          style={{
            width: '100%', padding: '12px',
            background: (!allReviewed || approving) ? '#ccc' : 'var(--primary)',
            color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500',
            cursor: (!allReviewed || approving) ? 'not-allowed' : 'pointer',
          }}
        >
          {approving ? 'Approving…' : 'Approve'}
        </button>
      </div>
    </div>
  )
}

export default ReviewDraft
