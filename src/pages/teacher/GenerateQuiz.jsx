import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import API_BASE from '../../api'
import TOPIC_TAGS from '../../data/topicTags'

// Three honest pending stages (§6.5) — no fake progress percentages, just staged reassurance
// copy so a slow real-provider call (or the mock's dev-only ~2s delay) never reads as frozen.
const PENDING_STAGES = [
  { afterMs: 0, text: 'Reading your document…' },
  { afterMs: 15000, text: 'Writing questions — bigger documents take longer…' },
  { afterMs: 45000, text: 'Nearly there — checking each question…' },
]
const PENDING_TIMEOUT_MS = 90000

function useStagedPending(active) {
  const [stageText, setStageText] = useState(PENDING_STAGES[0].text)
  useEffect(() => {
    if (!active) { setStageText(PENDING_STAGES[0].text); return }
    const timers = PENDING_STAGES.map(s => setTimeout(() => setStageText(s.text), s.afterMs))
    return () => timers.forEach(clearTimeout)
  }, [active])
  return stageText
}

function GenerateQuiz() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [attested, setAttested] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [source, setSource] = useState(null) // { sourceId, kind, pageCount, chunkCount, truncated, sectionPreviews }

  const [questionCount, setQuestionCount] = useState(5)
  const [topicTag, setTopicTag] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)

  const pendingText = useStagedPending(uploading || generating)

  async function handleUpload() {
    if (!file || !attested) return
    setUploading(true)
    setUploadError(null)
    try {
      const form = new FormData()
      form.append('attested', 'true')
      form.append('file', file)
      const res = await fetch(`${API_BASE}/generation/sources`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.')
      setSource(body)
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleGenerate() {
    setGenerateError(null)
    setGenerating(true)
    const timeoutId = setTimeout(() => {
      setGenerating(false)
      setGenerateError('This is taking longer than expected. Try again.')
    }, PENDING_TIMEOUT_MS)
    try {
      const range = rangeStart !== '' && rangeEnd !== ''
        ? { start: Number(rangeStart), end: Number(rangeEnd) }
        : undefined
      const res = await fetch(`${API_BASE}/generation/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: source.sourceId,
          questionCount,
          ...(topicTag && { topicTag }),
          ...(range && { range }),
        }),
      })
      clearTimeout(timeoutId)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.')
      navigate(`/teacher/drafts/${body.id}`)
    } catch (err) {
      clearTimeout(timeoutId)
      setGenerateError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginBottom: '6px' }}>Draft a quiz from your document</h2>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>
        Upload a document and get a draft quiz to review — you approve every question.
      </p>

      {!source && (
        <>
          <div
            data-testid="generate-dropzone"
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #ccc', borderRadius: '12px', padding: '40px 20px',
              textAlign: 'center', cursor: 'pointer', marginBottom: '16px',
              background: file ? '#f8f8f8' : 'white',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>
              {file ? file.name : 'Click to choose a PDF, Word doc, or text file'}
            </div>
            <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>Up to 15MB</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={e => setFile(e.target.files[0] || null)}
              style={{ display: 'none' }}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '14px', background: '#FFF6E5', border: '1px solid #E8C468', borderRadius: '8px', fontSize: '13px', color: '#6B5200', marginBottom: '16px', cursor: 'pointer' }}>
            <input type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)} style={{ marginTop: '2px' }} />
            <span>I confirm I have the right to use this document to generate quiz questions.</span>
          </label>

          {uploadError && (
            <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
              {uploadError}
            </div>
          )}

          {uploading && (
            <div role="status" aria-live="polite" style={{ padding: '10px 14px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--primary)', marginBottom: '16px' }}>
              ⏳ {pendingText}
            </div>
          )}

          <button
            data-testid="generate-upload-button"
            disabled={!file || !attested || uploading}
            onClick={handleUpload}
            style={{
              width: '100%', padding: '12px',
              background: (!file || !attested || uploading) ? '#ccc' : 'var(--primary)',
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500',
              cursor: (!file || !attested || uploading) ? 'not-allowed' : 'pointer',
            }}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </>
      )}

      {source && (
        <>
          <div style={{ padding: '12px 14px', background: '#E1F5EE', border: '1px solid #1a7a5e', borderRadius: '8px', fontSize: '13px', color: '#085041', marginBottom: '20px' }}>
            {source.kind === 'pdf' ? `${source.pageCount} pages read ✓` : `${source.chunkCount} sections read ✓`}
            {source.truncated && ' — we read as much as we could fit.'}
          </div>

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
            Number of questions
          </label>
          <input
            data-testid="generate-question-count"
            type="number" min={3} max={15}
            value={questionCount}
            onChange={e => setQuestionCount(Number(e.target.value))}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '16px' }}
          />

          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
            Topic <span style={{ fontWeight: '400', color: '#aaa' }}>(optional)</span>
          </label>
          <select
            value={topicTag}
            onChange={e => setTopicTag(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '16px', background: 'white' }}
          >
            <option value="">No topic</option>
            {TOPIC_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {source.chunkCount > 1 && (
            <>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
                {source.kind === 'pdf' ? 'Page range' : 'Section range'} <span style={{ fontWeight: '400', color: '#aaa' }}>(optional)</span>
              </label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  data-testid="generate-range-start"
                  type="number" min={0} max={source.chunkCount - 1} placeholder="from"
                  value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box' }}
                />
                <input
                  data-testid="generate-range-end"
                  type="number" min={0} max={source.chunkCount - 1} placeholder="to"
                  value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '16px' }}>
                {source.sectionPreviews?.slice(0, 6).map(p => (
                  <div key={p.index}>{p.page ? `Page ${p.page}` : `Section ${p.index + 1}`}: {p.preview}</div>
                ))}
              </div>
            </>
          )}

          {generateError && (
            <div style={{ padding: '10px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b', marginBottom: '16px' }}>
              {generateError}
            </div>
          )}

          {generating && (
            <div role="status" aria-live="polite" style={{ padding: '10px 14px', background: 'var(--surface2)', border: 'var(--bw) solid var(--border)', borderRadius: '8px', fontSize: '13px', color: 'var(--primary)', marginBottom: '16px' }}>
              ⏳ {pendingText}
            </div>
          )}

          <button
            data-testid="generate-submit-button"
            disabled={generating}
            onClick={handleGenerate}
            style={{
              width: '100%', padding: '12px',
              background: generating ? '#ccc' : 'var(--primary)',
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '500',
              cursor: generating ? 'not-allowed' : 'pointer',
            }}
          >
            {generating ? 'Drafting your quiz — this can take a minute' : `Generate ${questionCount} questions`}
          </button>
        </>
      )}
    </div>
  )
}

export default GenerateQuiz
