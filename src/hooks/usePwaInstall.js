import { useEffect, useState } from 'react'

// Pure platform detection — exported for unit testing without a DOM.
// Returns "ios" for iOS Safari, "native" when the browser fired a beforeinstallprompt
// (Chrome/Edge/Android), or "unsupported" otherwise (e.g. desktop Firefox, which has no
// programmatic install).
export function detectPlatform({ userAgent = '', hasMSStream = false, hasInstallPrompt = false } = {}) {
  if (hasInstallPrompt) return 'native'
  if (/iPad|iPhone|iPod/.test(userAgent) && !hasMSStream) return 'ios'
  return 'unsupported'
}

// Pure already-installed check — exported for unit testing.
export function detectInstalled({ standalone = false, navigatorStandalone = false } = {}) {
  return standalone === true || navigatorStandalone === true
}

// Hook exposing { canInstall, install, isInstalled, platform }.
// - beforeinstallprompt: preventDefault, stash the event, flag installable (platform "native").
// - appinstalled: mark installed, clear installable.
// - iOS has no programmatic install — platform "ios" drives the manual Add-to-Home-Screen guide.
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() =>
    detectInstalled({
      standalone:
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(display-mode: standalone)').matches,
      navigatorStandalone: typeof navigator !== 'undefined' && navigator.standalone === true,
    })
  )

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      // Stop Chrome's default mini-infobar so we can present our own button.
      e.preventDefault()
      setDeferredPrompt(e)
      setCanInstall(true)
    }
    function onAppInstalled() {
      setIsInstalled(true)
      setCanInstall(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const platform = detectPlatform({
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    hasMSStream: typeof window !== 'undefined' && !!window.MSStream,
    hasInstallPrompt: canInstall,
  })

  async function install() {
    if (!deferredPrompt) return null
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    // The event can only be used once.
    setDeferredPrompt(null)
    setCanInstall(false)
    return choice
  }

  return { canInstall, install, isInstalled, platform }
}

export default usePwaInstall
