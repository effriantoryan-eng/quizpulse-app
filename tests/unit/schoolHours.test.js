// Unit tests for src/data/schoolHours.js — v4.11.0 R2 (D2.5) after-hours warning. The source is an
// ESM module (Vite-only); Jest's CJS runner can't require() it directly, so this mirrors the logic
// (same convention as confidenceTally.test.js / topicPrefilter.test.js).

function isOutsideSchoolHours(date, { startHour = 7, endHour = 18 } = {}) {
  const day = date.getDay()
  if (day === 0 || day === 6) return true
  const hour = date.getHours()
  return hour < startHour || hour >= endHour
}

// 2026-01-05 is a Monday, 2026-01-10 is a Saturday (local-time constructors, so the weekday is
// timezone-independent). Guarded by a sanity check so a bad fixture fails loudly, not silently.
const mon = (h, m = 0) => new Date(2026, 0, 5, h, m)
const sat = (h, m = 0) => new Date(2026, 0, 10, h, m)

describe('isOutsideSchoolHours', () => {
  test('fixture sanity — the constructed dates are the intended weekdays', () => {
    expect(mon(9).getDay()).toBe(1)
    expect(sat(10).getDay()).toBe(6)
  })

  test('boundaries — Mon 06:59 true, 07:00 false, 17:59 false, 18:00 true; Sat 10:00 true', () => {
    expect(isOutsideSchoolHours(mon(6, 59))).toBe(true)
    expect(isOutsideSchoolHours(mon(7, 0))).toBe(false)
    expect(isOutsideSchoolHours(mon(17, 59))).toBe(false)
    expect(isOutsideSchoolHours(mon(18, 0))).toBe(true)
    expect(isOutsideSchoolHours(sat(10, 0))).toBe(true)
  })
})
