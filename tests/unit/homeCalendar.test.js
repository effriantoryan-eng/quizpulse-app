// Unit tests for src/data/homeCalendar.js — v4.7.0 T1 Home calendar date math. The source is an
// ESM module (Vite-only); Jest's CJS runner can't require() it directly, so this mirrors the
// logic for isolated testing (same convention as topicPrefilter.test.js / demoNav.test.js).

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function effectiveDates(quiz) {
  const dates = []
  if (quiz.sentAt) dates.push(new Date(quiz.sentAt))
  if (quiz.scheduledFor) dates.push(new Date(quiz.scheduledFor))
  return dates
}

function quizzesOnDay(quizzes, day) {
  return quizzes.filter((q) => effectiveDates(q).some((d) => sameDay(d, day)))
}

function startOfWeek(date) {
  const d = new Date(date)
  const dow = d.getDay()
  const diff = (dow === 0 ? -6 : 1) - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function weekDays(anchor) {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function monthGrid(anchor) {
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

describe('homeCalendar — pure date math (v4.7.0 T1)', () => {
  it('sameDay compares calendar date only, ignoring time', () => {
    expect(sameDay(new Date('2026-08-17T01:00:00'), new Date('2026-08-17T23:00:00'))).toBe(true)
    expect(sameDay(new Date('2026-08-17T01:00:00'), new Date('2026-08-18T01:00:00'))).toBe(false)
  })

  it('startOfWeek returns the Monday on or before the given date', () => {
    // 2026-08-17 is a Monday.
    const monday = startOfWeek(new Date('2026-08-19T12:00:00')) // Wednesday
    expect(monday.getDate()).toBe(17)
    expect(monday.getDay()).toBe(1)
  })

  it('startOfWeek handles Sunday (wraps back to the prior Monday)', () => {
    const monday = startOfWeek(new Date('2026-08-23T12:00:00')) // Sunday
    expect(monday.getDate()).toBe(17)
  })

  it('weekDays returns 7 consecutive days starting Monday', () => {
    const days = weekDays(new Date('2026-08-19T12:00:00'))
    expect(days).toHaveLength(7)
    expect(days[0].getDate()).toBe(17)
    expect(days[6].getDate()).toBe(23)
  })

  it('monthGrid covers the whole month in full weeks (multiple of 7)', () => {
    const days = monthGrid(new Date('2026-08-17T12:00:00'))
    expect(days.length % 7).toBe(0)
    const augDays = days.filter((d) => d.getMonth() === 7 && d.getFullYear() === 2026)
    expect(augDays).toHaveLength(31)
  })

  it('quizzesOnDay matches a quiz by sentAt or scheduledFor landing on that day', () => {
    // Local (no 'Z') timestamps — sameDay() compares local calendar date, so this avoids the test
    // itself becoming timezone-dependent.
    const day = new Date('2026-08-17T00:00:00')
    const quizzes = [
      { id: 'a', sentAt: '2026-08-17T09:00:00' },
      { id: 'b', scheduledFor: '2026-08-17T15:00:00' },
      { id: 'c', sentAt: '2026-08-16T09:00:00' },
    ]
    const matched = quizzesOnDay(quizzes, day).map((q) => q.id)
    expect(matched.sort()).toEqual(['a', 'b'])
  })
})
