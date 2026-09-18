const LINE = {
  background: 'var(--surface2)',
  animation: 'skeleton-pulse 1.4s ease-in-out infinite',
  height: '14px',
  marginBottom: '10px',
}

export function SkeletonLines({ lines = 3 }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} style={{ ...LINE, width: i === lines - 1 ? '60%' : '100%' }} />
      ))}
    </div>
  )
}

export function SkeletonBlock({ height = 120 }) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <div style={{ ...LINE, height, marginBottom: 0, width: '100%' }} />
    </div>
  )
}
