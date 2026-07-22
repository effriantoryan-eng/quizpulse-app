// Local persistence of the classes this device has been approved for. This is the localStorage
// side of the device-UUID model — named student accounts (out of scope for v4.5.0, gated behind
// pilot validation) are the permanent fix; this rides on the browser storage surviving.
const KEY = 'quizpulse_approved_classes' // [{ classId, className }]

export function getApprovedClasses() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addApprovedClass(classId, className) {
  const existing = getApprovedClasses().filter(c => c.classId !== classId)
  existing.push({ classId, className })
  localStorage.setItem(KEY, JSON.stringify(existing))
}
