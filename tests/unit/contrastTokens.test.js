// WCAG 2.1 contrast ratio tests for design tokens (Task 2, R4)
// Formula: (L1+0.05)/(L2+0.05) where L = relative luminance per IEC 61966-2-1
// Self-check row proves the gamma expansion is correct: #767676 on white ≈ 4.54:1

function srgbToLinear(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
}

function contrastRatio(fg, bg) {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

const WHITE = '#ffffff'
const AA_NORMAL = 4.5

describe('contrast token self-check', () => {
  test('#767676 on white is ≥4.5:1 (known WCAG borderline pair)', () => {
    const ratio = contrastRatio('#767676', WHITE)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
    expect(ratio).toBeLessThan(5) // sanity bound — should be ~4.54
  })
})

describe('WCAG AA contrast — design tokens on white', () => {
  test('--primary (#ca2910) meets AA on white', () => {
    expect(contrastRatio('#ca2910', WHITE)).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  test('--muted (#6b6868) meets AA on white', () => {
    expect(contrastRatio('#6b6868', WHITE)).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})

describe('WCAG AA contrast — fourCell.js label colors on their fills', () => {
  test('correctConfident border (#3B6D11) on fill (#DCEFC8)', () => {
    expect(contrastRatio('#3B6D11', '#DCEFC8')).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  test('correctUnsure border (#547935) on fill (#EEF6E4)', () => {
    expect(contrastRatio('#547935', '#EEF6E4')).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  test('incorrectConfident border (#AE1800) on fill (#FFE0D9)', () => {
    expect(contrastRatio('#AE1800', '#FFE0D9')).toBeGreaterThanOrEqual(AA_NORMAL)
  })

  test('incorrectUnsure border (#906909) on fill (#FDF3E3)', () => {
    expect(contrastRatio('#906909', '#FDF3E3')).toBeGreaterThanOrEqual(AA_NORMAL)
  })
})
