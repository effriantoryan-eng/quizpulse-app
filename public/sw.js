/* QuizPulse service worker — push + notification click handling. */

self.addEventListener('install', () => {
  // Activate immediately so the latest SW controls the page on next load.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Display the push notification sent by the backend.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'QuizPulse', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'QuizPulse'
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// --- Background Sync: flush quiz responses queued while offline ---
// Mirrors the IndexedDB schema in src/offlineQueue.js (can't share an ES module with a
// classic-script service worker), so keep the store name/shape in sync if either changes.

const OFFLINE_DB_NAME = 'quizpulse-offline'
const OFFLINE_STORE_NAME = 'pending-responses'

function getApiBase() {
  return self.location.hostname === 'localhost'
    ? 'http://localhost:7071/api'
    : (self.location.origin + '/api')
}

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
        req.result.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getAllPendingResponses() {
  const db = await openOfflineDb()
  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readonly')
    const req = tx.objectStore(OFFLINE_STORE_NAME).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items
}

async function deletePendingResponse(id) {
  const db = await openOfflineDb()
  await new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE_NAME, 'readwrite')
    tx.objectStore(OFFLINE_STORE_NAME).delete(id)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

async function flushPendingResponses() {
  const pending = await getAllPendingResponses()
  const apiBase = getApiBase()

  for (const item of pending) {
    try {
      const res = await fetch(`${apiBase}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: item.quizId, studentId: item.studentId, answers: item.answers }),
      })
      // 201 = stored. 409 = another submission for this student/quiz already landed —
      // either way there's nothing left to retry, so drop it from the queue.
      if (res.ok || res.status === 409) {
        await deletePendingResponse(item.id)
      }
    } catch {
      // Still offline — leave it queued, the next sync event will retry.
    }
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-responses') {
    event.waitUntil(flushPendingResponses())
  }
})

// Deep-link into the quiz when the notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    }),
  )
})
