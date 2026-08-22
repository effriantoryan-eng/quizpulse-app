import qrcode from 'qrcode-generator'

// Renders a QR code as inline divs (no <canvas>, no external request — works fully offline).
// Self-contained per v4.7.0 T4: bundles the tiny qrcode-generator lib instead of hotlinking a CDN
// script (the mockup's jsdelivr script wouldn't pass this app's CSP).
export default function QRCode({ value, size = 180, moduleColor = 'var(--text)' }) {
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()
  const count = qr.getModuleCount()
  const cell = size / count

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="QR code to join this class"
      style={{ display: 'block', background: '#fff' }}
    >
      {Array.from({ length: count }).map((_, r) =>
        Array.from({ length: count }).map((_, c) =>
          qr.isDark(r, c) ? (
            <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={moduleColor} />
          ) : null
        )
      )}
    </svg>
  )
}
