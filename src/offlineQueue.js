// IndexedDB-backed queue for quiz responses that fail to submit while offline.
// Mirrored (duplicated, since the service worker can't import ES modules) in public/sw.js,
// which flushes this same store on the 'sync-responses' Background Sync event.

const DB_NAME = 'quizpulse-offline'
const STORE_NAME = 'pending-responses'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueResponse(record) {
  const db = await openDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// Registers a Background Sync request. Returns false (instead of throwing) on browsers
// without Background Sync support (e.g. Safari) so callers can fall back gracefully —
// the queued response still flushes next time the SW activates with connectivity.
export async function registerResponseSync() {
  if (!('serviceWorker' in navigator)) return false
  try {
    const reg = await navigator.serviceWorker.ready
    if (!('sync' in reg)) return false
    await reg.sync.register('sync-responses')
    return true
  } catch {
    return false
  }
}
