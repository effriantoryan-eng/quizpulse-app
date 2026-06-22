import usePwaInstall from '../hooks/usePwaInstall'
import IosInstallBanner from './IosInstallBanner'

// Offers adding QuizPulse to the phone's home screen, branching on platform:
//   "native"      → an "Add to your phone" button that triggers the browser install prompt.
//   "ios"         → the iOS add-to-home-screen guide (reused Sprint 3 banner), since iOS has
//                   no programmatic install and lock-screen check-ins require the installed app.
//   "unsupported" → nothing (e.g. desktop Firefox).
// Also renders nothing once the app is already installed.
//
// Optional `description` renders a line of plain-language copy above the button (used on the
// Join page); `align` controls horizontal alignment (default "center").
export default function InstallButton({ description, align = 'center' }) {
  const { install, isInstalled, platform } = usePwaInstall()

  if (isInstalled || platform === 'unsupported') return null

  if (platform === 'ios') {
    return <IosInstallBanner />
  }

  // platform === 'native'
  return (
    <div data-testid="install-button" style={{ textAlign: align }}>
      {description && (
        <p style={{ fontSize: '13px', color: '#666', lineHeight: '1.6', margin: '0 0 10px' }}>
          {description}
        </p>
      )}
      <button
        onClick={() => install()}
        style={{
          padding: '10px 18px', background: '#fff', color: '#534AB7',
          border: '1px solid #534AB7', borderRadius: '10px',
          fontSize: '14px', fontWeight: '600', cursor: 'pointer',
        }}
      >
        📲 Add to your phone
      </button>
    </div>
  )
}
