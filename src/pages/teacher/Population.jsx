import { useState, useEffect } from 'react'
import API_BASE from '../../api'
import TOPIC_TAGS from '../../data/topicTags'

// Directional comparison bar for one metric — "you" vs "norm" markers on a single 0-100 track.
// Works identically at any viewport width (no separate mobile layout needed): two side-by-side
// summary cards would bury the comparison on a phone, so this is the ONE layout, not two.
function ComparisonBar({ label, yourValue, normValue, higherIsConcern }) {
  if (yourValue === null || normValue === null) return null
  const gap = Math.round((yourValue - normValue) * 10) / 10
  const concern = higherIsConcern ? gap > 0 : gap < 0

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '500', color: '#333', marginBottom: '8px' }}>
        <span>{label}</span>
        <span>{yourValue}% vs {normValue}% (norm)</span>
      </div>
      <div style={{ position: 'relative', height: '10px', background: '#f0f0f0', borderRadius: '5px', marginBottom: '6px' }}>
        <div
          data-testid="comparison-marker-norm"
          style={{ position: 'absolute', left: `${normValue}%`, top: '-3px', width: '2px', height: '16px', background: '#888' }}
        />
        <div
          data-testid="comparison-marker-you"
          style={{
            position: 'absolute', left: `calc(${yourValue}% - 6px)`, top: '-5px', width: '12px', height: '12px', borderRadius: '50%',
            background: concern ? '#B5482E' : 'var(--primary)', border: '2px solid white', boxShadow: '0 0 0 1px #ccc',
          }}
        />
      </div>
      <div style={{ fontSize: '12px', color: concern ? '#B5482E' : '#666' }}>
        {gap === 0
          ? 'Right at the norm for this topic.'
          : concern
            ? `Your cohort ${label === 'Confident-but-wrong' ? 'has more confident wrong answers' : 'is below the norm'} than most schools — worth a closer look.`
            : `Your cohort is ${label === 'Confident-but-wrong' ? 'lower on confident-but-wrong answers' : 'above the norm'} than most schools on this topic.`}
      </div>
    </div>
  )
}

function Population() {
  const [topic, setTopic] = useState(TOPIC_TAGS[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchPopulation() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/analytics/population?topic=${encodeURIComponent(topic)}`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Server error ${res.status}`)
        }
        const body = await res.json()
        if (!cancelled) setData(body)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPopulation()
    return () => { cancelled = true }
  }, [topic])

  const hasSchoolData = data && data.school.responseCount > 0
  const hasPopulationData = data && data.population.responseCount > 0

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginBottom: '6px' }}>Population</h2>
      <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
        See how your school compares to other QuizPulse schools on a topic.
      </p>

      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#555', marginBottom: '6px' }}>
        Topic
      </label>
      <select
        data-testid="population-topic-select"
        value={topic}
        onChange={e => setTopic(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: 'var(--bw) solid var(--border)', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '24px', background: 'white' }}
      >
        {TOPIC_TAGS.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {loading && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#888', fontSize: '14px' }}>Loading…</div>
      )}

      {error && (
        <div style={{ padding: '12px 14px', background: '#fdecea', border: '1px solid #c0392b', borderRadius: '8px', fontSize: '13px', color: '#c0392b' }}>
          Couldn't load benchmark — {error}
        </div>
      )}

      {!loading && !error && data && !hasPopulationData && (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: '#888', fontSize: '14px', background: '#f8f8f8', borderRadius: '12px' }}>
          No benchmark data for {topic} yet.
        </div>
      )}

      {!loading && !error && data && hasPopulationData && !hasSchoolData && (
        <div style={{ padding: '14px', background: '#f8f8f8', borderRadius: '8px', fontSize: '13px', color: '#888', marginBottom: '20px', textAlign: 'center' }}>
          You haven't sent a quiz tagged {topic} yet — pick a topic when you send a quiz to see your own comparison here.
        </div>
      )}

      {!loading && !error && data && hasPopulationData && (
        <div style={{ background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div
            data-testid="population-seed-pill"
            style={{ display: 'inline-block', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', background: '#EEEDFE', color: '#3C3489', marginBottom: '10px' }}
          >
            Benchmark data
          </div>
          <div style={{ fontSize: '11px', color: '#bbb', marginBottom: '16px' }}>
            This benchmark is a seeded sample of 100 schools — real network data will replace it as more schools use QuizPulse.
          </div>
          <ComparisonBar
            label="Correct answers"
            yourValue={hasSchoolData ? data.school.pctCorrect : null}
            normValue={data.population.pctCorrect}
            higherIsConcern={false}
          />
          <ComparisonBar
            label="Confident-but-wrong"
            yourValue={hasSchoolData ? data.school.pctConfidentIncorrect : null}
            normValue={data.population.pctConfidentIncorrect}
            higherIsConcern
          />
        </div>
      )}
    </div>
  )
}

export default Population
