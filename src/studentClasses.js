// Local persistence of the classes this device has been approved for. This is the localStorage
// side of the device-UUID model — named student accounts (out of scope for v4.5.0, gated behind
// pilot validation) are the permanent fix; this rides on the browser storage surviving.
const KEY = 'quizpulse_approved_classes' // [{ classId, className }]

// ponytail: pending attempts are remembered locally so we can reconcile against the existing
// in-partition status endpoint on the next load — instead of a device-only server lookup, which
// would be a cross-partition scan of join_requests (pk /classId). Named student accounts are the
// real fix; this is the browser-storage bridge until then.
const PENDING_KEY = 'quizpulse_pending_classes' // [{ classId, className, requestId, status }]

export function getApprovedClasses() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// joinCode is optional (v4.7.0 T4) — captured from the student's own typed code at approval time
// so the class-home QR panel ("Join this class") can render without a new endpoint. A device
// approved before v4.7.0 simply has no joinCode on its local record; the QR panel just doesn't
// render for it (ponytail: graceful degrade, not a backfill).
export function addApprovedClass(classId, className, joinCode) {
  const existing = getApprovedClasses().filter(c => c.classId !== classId)
  existing.push({ classId, className, ...(joinCode && { joinCode }) })
  localStorage.setItem(KEY, JSON.stringify(existing))
}

export function getPendingClasses() {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addPendingClass(classId, className, requestId, status) {
  const existing = getPendingClasses().filter(c => c.classId !== classId)
  existing.push({ classId, className, requestId, status })
  localStorage.setItem(PENDING_KEY, JSON.stringify(existing))
}

export function removePendingClass(classId) {
  const remaining = getPendingClasses().filter(c => c.classId !== classId)
  localStorage.setItem(PENDING_KEY, JSON.stringify(remaining))
}

// Ask the server whether any locally-remembered pending request has been decided, and promote
// approved ones into the approved list. This is what lets a device that closed the tab before the
// teacher approved still find its way in. A network failure is a silent no-op — nothing is dropped.
export async function reconcileApprovals(deviceId, apiBase) {
  const pending = getPendingClasses()
  const newlyApproved = []
  await Promise.all(pending.map(async ({ classId, className }) => {
    try {
      const res = await fetch(
        `${apiBase}/join-request/status?deviceId=${encodeURIComponent(deviceId)}&classId=${encodeURIComponent(classId)}`
      )
      // 404 = the server has no such request (definitive, not transient) — drop the bogus record
      // so it can't re-lock the join screen forever. Other non-OK (5xx/rate-limit) is transient.
      if (res.status === 404) { removePendingClass(classId); return }
      if (!res.ok) return
      const data = await res.json()
      if (data.status === 'approved') {
        addApprovedClass(classId, className)
        removePendingClass(classId)
        newlyApproved.push(classId)
      } else if (data.status === 'rejected') {
        removePendingClass(classId)
      }
      // pending / queued: leave in place, try again next load
    } catch {
      // silent — keep the pending record for a later retry
    }
  }))
  return { approved: getApprovedClasses(), newlyApproved }
}
