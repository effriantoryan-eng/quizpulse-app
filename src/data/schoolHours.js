// v4.11.0 R2 (D2.5) — is a moment outside typical school hours? Used to warn (never block) a teacher
// before a send, schedule or spaced repeat that would notify students at an odd time.
//
// Pure: the caller passes the Date, so nothing here reads the clock (tests pin a moment without
// mocking Date.now). "Outside" = a weekend, or a local hour outside [startHour, endHour). School
// timezone isn't in the data model, so this is judged in the teacher's own local time — a warning,
// not a hard rule (that's exactly why D2.5 warns rather than blocks server-side).
export function isOutsideSchoolHours(date, { startHour = 7, endHour = 18 } = {}) {
  const day = date.getDay() // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) return true
  const hour = date.getHours()
  return hour < startHour || hour >= endHour
}
