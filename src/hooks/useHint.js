import { useState } from 'react'

export function useHint(key) {
  const storageKey = `quizpulse_hint_${key}`
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'dismissed' }
    catch { return true }
  })

  function dismiss() {
    setVisible(false)
    try { localStorage.setItem(storageKey, 'dismissed') } catch {}
  }

  function show() {
    setVisible(true)
    try { localStorage.removeItem(storageKey) } catch {}
  }

  return [visible, dismiss, show]
}
