import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useHint } from '../../hooks/useHint'
import HintBanner from '../../components/HintBanner'
import API_BASE from '../../api'

const OPTION_COLORS = ['#E6F1FB', '#EEEDFE', '#FAEEDA', '#FBEAF0']
const OPTION_BORDER = ['#185FA5', '#534AB7', '#633806', '#4B1528']
const CORRECT_BG = '#EAF3DE'
const CORRECT_BORDER = '#3B6D11'

function Analytics() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const [hintVisible, dismissHint, showHint] = useHint('analytics')
  const [quiz, setQuiz] = useState(null)
  const [classSize, setClassSize] = useState(null)
  const [questions, setQuestions] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const quizRes = await fetch(`${API_BASE}/quizzes/${quizId}`)
        if (quizRes.status === 404) throw new Error('Quiz not found')
        if (!quizRes.ok) throw new Error(`Server error ${quizRes.status}`)
        const quizData = await quizRes.json()

        const [responsesRes, questionsRes] = await Promise.all([
          fetch(`${API_BASE}/responses?quizId=${quizId}`),
          fetch(`${API_BASE}/questions?teacherId=${quizData.teacherId}`)
        ])

        if (!responsesRes.ok || !questionsRes.ok) throw new Error('Failed to load data')

        const responsesData = await responsesRes.json()
        const allQuestions = await questionsRes.json()
        const quizQuestions = quizData.questionIds
          .map(qid => allQuestions.find(q => q.id === qid))
          .filter(Boolean)

        setResponses(responsesData)
        setQuestions(quizQuestions)
        setClassSize(quizData.classSize || null)
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }
    fetchData()
  }, [quizId])

  function getOptionCounts(questionId, optionCount) {
    const counts = Array(optionCount).fill(0)
    responses.forEach(r => {
      const answer = r.answers?.find(a => a.questionId === questionId)
      if (answer !== undefined && answer.selectedIndex >= 0) {
        counts[answer.selectedIndex]++
      }
    })
    return counts
  }

  if (loading) return <div style={{ padding: '24px', color: '#888' }}>Loading analytics...</div>
  if (error) return <div style={{ padding: '24px', color: '#A32D2D' }}>{error}</div>

  const totalResponses = responses.length

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={() => navigate('/teacher/quizzes')}
          style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', color: '#666' }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Quiz Analytics</h2>
          <div style={{ fontSize: '13px', color: '#888', marginTop: '2px' }}>Quiz ID: {quizId}</div>
        </div>
        {!hintVisible && (
          <button onClick={showHint} style={{ background: 'none', border: '1px solid #C5C0F0', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', color: '#7B6EDE', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</button>
        )}
      </div>
      {hintVisible && (
        <HintBanner
          text="Each question shows how the class responded. The green bar is the correct answer. Use the question cards below to see the full breakdown."
          onDismiss={dismissHint}
        />
      )}


      {/* Summary card */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: '#534AB7', borderRadius: '12px', padding: '20px', color: 'white', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '600' }}>
            {classSize ? `${totalResponses} / ${classSize}` : totalResponses}
          </div>
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Students responded</div>
        </div>
        <div style={{ background: '#EAF3DE', borderRadius: '12px', padding: '20px', color: '#3B6D11', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', fontWeight: '600' }}>{questions.length}</div>
          <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>Questions in quiz</div>
        </div>
      </div>

      {/* Per question breakdown */}
      {questions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#aaa', fontSize: '14px' }}>
          No questions found for this quiz.
        </div>
      )}

      {questions.map((q, qi) => {
        const counts = getOptionCounts(q.id, q.options.length)
        const total = counts.reduce((a, b) => a + b, 0)

        return (
          <div key={q.id} style={{ background: 'white', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            
            <div style={{ fontSize: '12px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
              Question {qi + 1}
            </div>
            <div style={{ fontSize: '15px', fontWeight: '500', lineHeight: '1.5', marginBottom: '20px', color: '#1a1a1a' }}>
              {q.text}
            </div>

            {q.options.map((opt, i) => {
              const count = counts[i]
              const percent = total > 0 ? Math.round((count / total) * 100) : 0
              const isCorrect = i === q.correctIndex
              const barWidth = percent

              return (
                <div key={i} style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{
                      width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '600',
                      background: isCorrect ? CORRECT_BG : OPTION_COLORS[i],
                      border: `1.5px solid ${isCorrect ? CORRECT_BORDER : OPTION_BORDER[i]}`,
                      color: isCorrect ? CORRECT_BORDER : OPTION_BORDER[i]
                    }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1, fontSize: '13px', color: '#333' }}>{opt}</span>
                    {isCorrect && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: CORRECT_BG, color: CORRECT_BORDER, flexShrink: 0 }}>
                        Correct
                      </span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#333', minWidth: '40px', textAlign: 'right' }}>
                      {percent}%
                    </span>
                  </div>
                  <div style={{ height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', marginLeft: '34px' }}>
                    <div style={{
                      height: '100%', borderRadius: '4px',
                      width: `${barWidth}%`,
                      background: isCorrect ? CORRECT_BORDER : OPTION_BORDER[i],
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#aaa', marginLeft: '34px', marginTop: '2px' }}>
                    {count} response{count !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {totalResponses === 0 && questions.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px', color: '#aaa', fontSize: '14px', background: '#f8f8f8', borderRadius: '12px' }}>
          No responses yet. Share the quiz link with students to see results here.
        </div>
      )}
    </div>
  )
}

export default Analytics