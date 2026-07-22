import API_BASE from './api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from(rawData, (c) => c.charCodeAt(0))
}

// Auto-enrols the approved screen into push — must never throw. Denied permission and
// missing PushManager (iOS not installed) are soft, expected outcomes, not failures; the page
// must render fine either way. Returns a status string for the caller to show (or ignore).
export async function autoSubscribe(classId, deviceId) {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'unsupported'
    }
    const keyRes = await fetch(`${API_BASE}/vapid-public-key`)
    if (!keyRes.ok) return 'error'
    const { publicKey } = await keyRes.json()

    const reg = await navigator.serviceWorker.ready
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    const subRes = await fetch(`${API_BASE}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, deviceId, subscription: subscription.toJSON() }),
    })
    return subRes.ok ? 'subscribed' : 'error'
  } catch (err) {
    if (err && err.name === 'NotAllowedError') return 'denied'
    return 'error'
  }
}
