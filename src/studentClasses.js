// Local persistence of the classes this device has been approved for. This is the localStorage
// side of the device-UUID model — named student accounts (out of scope for v4.5.0, gated behind
// pilot validation) are the permanent fix; this rides on the browser storage surviving.
const KEY = 'quizpulse_approved_classes' // [{ classId, className }]

// ponytail: pending attempts are remembered locally so we can reconcile against the existing
// in-partition status endpoint on the next load — instead of a device-only server lookup, which
// would be a cross-partition scan of join_requests (pk /classId). Named student accounts are the
// real fix; this is the browser-storage bridge until then.
const PENDING_KEY = 'quizpulse_pending_classes' // [{ classId, className, requestId, status }]

// Per-class notification off-list (v4.11.0 R2). A local record of the classes this device has turned
// notifications OFF for — separate from leaving, which removes the class entirely. Array of classIds.
const NOTIF_OFF_KEY = 'quizpulse_notifications_off'

export function getApprovedClasses() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Remove one class from this device's approved list (used when the student leaves a class).
export function removeApprovedClass(classId) {
  try {
    const remaining = getApprovedClasses().filter(c => c.classId !== classId)
    localStorage.setItem(KEY, JSON.stringify(remaining))
  } catch {
    // storage blocked — the class stays listed locally; harmless (the server already removed it)
  }
}

export function getNotificationsOff() {
  try {
    const raw = localStorage.getItem(NOTIF_OFF_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function isNotificationsOff(classId) {
  return getNotificationsOff().includes(classId)
}

export function addNotificationsOff(classId) {
  try {
    const set = new Set(getNotificationsOff())
    set.add(classId)
    localStorage.setItem(NOTIF_OFF_KEY, JSON.stringify([...set]))
  } catch {
    // storage blocked — notifications stay on; the student can retry
  }
}

export function removeNotificationsOff(classId) {
  try {
    const remaining = getNotificationsOff().filter(c => c !== classId)
    localStorage.setItem(NOTIF_OFF_KEY, JSON.stringify(remaining))
  } catch {
    // storage blocked — no-op
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
      // R3 (audit #9): device id in the X-Device-Id header, not the query string.
      const res = await fetch(
        `${apiBase}/join-request/status?classId=${encodeURIComponent(classId)}`,
        { headers: { 'X-Device-Id': deviceId } }
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
