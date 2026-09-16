import API_BASE from './api'
import { buildPageViewPayload, sendPageViewBeacon } from './hooks/usePageView'
import { detectPlatform } from './hooks/usePwaInstall'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}

// Derive the coarse platform for consent beacons (review D4). Three values, not a fingerprint.
function getConsentPlatform() {
  const p = detectPlatform({
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    hasMSStream: typeof window !== 'undefined' && !!window.MSStream,
    // hasInstallPrompt only matters for 'native' vs 'ios'; both map to non-desktop here.
    hasInstallPrompt: typeof window !== 'undefined' && !!window.__qpInstallPrompt,
  })
  if (p === 'ios') return 'ios'
  if (p === 'native') return 'android'
  return 'desktop'
}

function fireConsentBeacon(eventType) {
  sendPageViewBeacon({
    ...buildPageViewPayload({ pathname: window.location.pathname, eventType }),
    platform: getConsentPlatform(),
  })
}

// Auto-enrols the approved screen into push — must never throw. Denied permission and
// missing PushManager (iOS not installed) are soft, expected outcomes, not failures; the page
// must render fine either way. Returns a status string for the caller to show (or ignore).
export async function autoSubscribe(classId, deviceId) {
  // CRITICAL (review E1): read permission BEFORE the subscribe call so we know whether this
  // call will actually show the browser prompt. A returning device that already granted doesn't
  // see a prompt; beaconing unconditionally would inflate grant-rate toward ~100% with devices
  // that never made a consent decision, destroying the metric's meaning.
  const permissionBefore = typeof Notification !== 'undefined' ? Notification.permission : null
  const willPrompt = permissionBefore === 'default'

  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'unsupported'
    }
    const keyRes = await fetch(`${API_BASE}/vapid-public-key`)
    if (!keyRes.ok) return 'error'
    const { publicKey } = await keyRes.json()

    const reg = await navigator.serviceWorker.ready

    if (willPrompt) fireConsentBeacon('push_prompted')

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    if (willPrompt) fireConsentBeacon('push_granted')

    const subRes = await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, deviceId, subscription: subscription.toJSON() }),
    })
    return subRes.ok ? 'subscribed' : 'error'
  } catch (err) {
    if (err && err.name === 'NotAllowedError') {
      // willPrompt is in scope here — beacon only when the call actually asked for permission.
      if (willPrompt) fireConsentBeacon('push_denied')
      return 'denied'
    }
    return 'error'
  }
}
