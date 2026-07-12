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
            ? label === 'Confident-but-wrong'
              ? 'Your cohort has more confident wrong answers than most schools — worth a closer look.'
              : label === 'Incorrect but unsure'
                ? 'Your cohort has more unsure wrong answers than most schools — worth a closer look.'
                : 'Your cohort scores below most schools on this topic — worth a closer look.'
            : label === 'Confident-but-wrong'
              ? 'Your cohort has fewer confident wrong answers than most schools on this topic.'
              : label === 'Incorrect but unsure'
                ? 'Your cohort has fewer unsure wrong answers than most schools on this topic.'
                : 'Your cohort scores above most schools on this topic.'}
      </div>
    </div>
  )
}

// Illustrative reference cloud for the quadrant scatter — NOT real classes. The benchmark
// container stores one aggregate rollup per topic, so there are no per-class points to plot;
// these dots exist to give the "your school" marker visual context until real network data
// exists. ponytail: static illustrative dots, replace with real per-school points when the
// benchmark stores them.
const REFERENCE_DOTS = [
  [55, 14], [60, 12], [62, 11], [58, 13], [65, 11], [68, 10], [70, 9], [75, 7],
  [78, 6], [80, 5], [50, 16], [48, 19], [45, 21], [85, 5], [90, 4], [63, 12],
  [69, 9], [57, 13], [66, 10], [52, 15], [77, 6], [83, 5],
]

// Quadrant scatter: correctness (x, 0-100) vs confident-but-wrong rate (y, 0-40).
// The population-average crosshair and the "your school" dot use real data; the grey
// reference cloud is an illustrative sample (see REFERENCE_DOTS).
function QuadrantScatter({ school, population }) {
  const X0 = 40, X1 = 320, Y0 = 210, Y1 = 14
  const tx = pct => X0 + (Math.min(Math.max(pct, 0), 100) / 100) * (X1 - X0)
  const ty = pct => Y0 - (Math.min(Math.max(pct, 0), 40) / 40) * (Y0 - Y1)
  const avgX = tx(population.pctCorrect)
  const avgY = ty(population.pctConfidentIncorrect)
  const hasYou = school.pctCorrect !== null
  const youX = hasYou ? tx(school.pctCorrect) : null
  const youY = hasYou ? ty(school.pctConfidentIncorrect) : null

  return (
    <div style={{ background: 'white', border: 'var(--bw) solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#aaa', marginBottom: '4px' }}>
        Where this sits, compared to other schools
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px', lineHeight: 1.5 }}>
        Each grey dot is a sample school. Schools toward the bottom-right are doing best — good scores with few confident-but-wrong answers.
      </div>
      <svg viewBox="0 0 340 250" style={{ width: '100%', height: 'auto', display: 'block' }} data-testid="population-scatter">
        <rect x={avgX} y={avgY} width={X1 - avgX} height={Y0 - avgY} fill="#EAF3DE" opacity="0.7" />
        <rect x={X0} y={Y1} width={avgX - X0} height={avgY - Y1} fill="#FBEDE8" opacity="0.7" />
        <line x1={avgX} y1={Y1} x2={avgX} y2={Y0} stroke="#999" strokeWidth="1" strokeDasharray="3,3" />
        <line x1={X0} y1={avgY} x2={X1} y2={avgY} stroke="#999" strokeWidth="1" strokeDasharray="3,3" />
        <text x={avgX + 4} y={Y1 + 10} fontSize="9" fill="#888">benchmark avg</text>
        <line x1={X0} y1={Y1} x2={X0} y2={Y0} stroke="#e0e0e0" strokeWidth="1.5" />
        <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke="#e0e0e0" strokeWidth="1.5" />
        <g fill="#b3b3b3" opacity="0.75">
          {REFERENCE_DOTS.map(([x, y], i) => <circle key={i} cx={tx(x)} cy={ty(y)} r="4" />)}
        </g>
        {hasYou && (
          <>
            <circle cx={youX} cy={youY} r="7" fill="#B5482E" stroke="white" strokeWidth="2" />
            <text x={youX + 10} y={youY - 3} fontSize="12" fontWeight="700" fill="#5A2416">Your school</text>
          </>
        )}
        <text x="180" y="235" fontSize="11" fill="#888" textAnchor="middle">Correct answers →</text>
        <text fontSize="11" fill="#888" textAnchor="middle" transform="translate(14,150) rotate(-90)">Confident-but-wrong →</text>
        <text x={X0} y="222" fontSize="9" fill="#aaa">0%</text>
        <text x="308" y="222" fontSize="9" fill="#aaa">100%</text>
        <text x="24" y="213" fontSize="9" fill="#aaa">0%</text>
        <text x="18" y="20" fontSize="9" fill="#aaa">40%</text>
      </svg>
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#888', marginTop: '8px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#b3b3b3', display: 'inline-block' }} /> Sample schools (illustrative)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: '#B5482E', display: 'inline-block' }} /> Your school</span>
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
          You haven't sent a quiz tagged {topic} yet — pick a topic when you send a quiz to see your own comparison here. (Practice quizzes sent to a demo class don't count.)
        </div>
      )}

      {/* Headline stat — the single number the page exists to surface (mockup 5b). Shown big
          and first: the bars below explain the detail, this card states the "what". Only
          rendered when the teacher has their own data to compare. */}
      {!loading && !error && data && hasPopulationData && hasSchoolData && (
        <div
          data-testid="population-headline"
          style={{ background: '#FBEDE8', border: '1px solid #B5482E', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '16px' }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#5A2416', marginBottom: '8px' }}>
            Confident but wrong
          </div>
          <div style={{ fontSize: '42px', fontWeight: '800', color: '#5A2416', lineHeight: 1 }}>
            {data.school.pctConfidentIncorrect}%
          </div>
          <div style={{ fontSize: '13px', color: '#7A3B28', marginTop: '8px', lineHeight: 1.5 }}>
            vs {data.population.pctConfidentIncorrect}% for other schools on this topic —{' '}
            <strong>
              {(() => {
                const gap = Math.round((data.school.pctConfidentIncorrect - data.population.pctConfidentIncorrect) * 10) / 10
                if (gap === 0) return 'right at the norm'
                return `${Math.abs(gap)} point${Math.abs(gap) === 1 ? '' : 's'} ${gap > 0 ? 'above' : 'below'} the norm`
              })()}
            </strong>
          </div>
        </div>
      )}

      {!loading && !error && data && hasPopulationData && (
        <QuadrantScatter school={data.school} population={data.population} />
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
          {/* Derived, not fabricated: incorrect-unsure = 100 - correct - confident-wrong. */}
          <ComparisonBar
            label="Incorrect but unsure"
            yourValue={hasSchoolData ? Math.round((100 - data.school.pctCorrect - data.school.pctConfidentIncorrect) * 10) / 10 : null}
            normValue={Math.round((100 - data.population.pctCorrect - data.population.pctConfidentIncorrect) * 10) / 10}
            higherIsConcern
          />
        </div>
      )}
    </div>
  )
}

export default Population
