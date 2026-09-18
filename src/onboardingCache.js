let _value = null
export function getOnboarded() { return _value }
export function setOnboarded(v) { _value = v }

// R3 Task 5 — cached alongside onboarded so RequireTeacher doesn't refetch /api/me on every route
// change just to check termsCurrent. null = not yet known; true/false once /api/me has answered.
let _termsCurrent = null
export function getTermsCurrent() { return _termsCurrent }
export function setTermsCurrent(v) { _termsCurrent = v }
