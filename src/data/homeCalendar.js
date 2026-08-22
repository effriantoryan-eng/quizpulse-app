// Pure date math for the v4.7.0 T1 Home calendar — extracted so week/month grid generation and
// day-matching are unit-testable without mounting a component (this repo has no jsdom/RTL; see
// tests/unit/demoNav.test.js for the house convention).

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// A quiz can land on more than one calendar day: when it was sent, and/or when it's scheduled for.
function effectiveDates(quiz) {
  const dates = []
  if (quiz.sentAt) dates.push(new Date(quiz.sentAt))
  if (quiz.scheduledFor) dates.push(new Date(quiz.scheduledFor))
  return dates
}

export function quizzesOnDay(quizzes, day) {
  return quizzes.filter((q) => effectiveDates(q).some((d) => sameDay(d, day)))
}

// Monday-start week containing `date`.
export function startOfWeek(date) {
  const d = new Date(date)
  const dow = d.getDay() // 0=Sun..6=Sat
  const diff = (dow === 0 ? -6 : 1) - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function weekDays(anchor) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

// Full weeks covering the anchor's month (leading/trailing days from adjacent months included, so
// the grid is always a clean 7-column rectangle).
export function monthGrid(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
  const start = startOfWeek(first)
  const end = startOfWeek(last)
  end.setDate(end.getDate() + 6)

  const days = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}
