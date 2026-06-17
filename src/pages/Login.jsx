import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'

// Returns true when running inside a social-app in-app browser (Meta IAB, Instagram,
// LinkedIn, Snapchat, Twitter/X, TikTok, Line, etc.) or a generic Android WebView.
// These environments intercept OAuth redirects and cannot complete the sign-in flow.
function isInAppBrowser() {
  const ua = navigator.userAgent || ''
  return (
    /FBAN|FBAV/i.test(ua) ||        // Facebook
    /Instagram/i.test(ua) ||
    /LinkedInApp/i.test(ua) ||
    /Snapchat/i.test(ua) ||
    /Twitter/i.test(ua) ||
    /TikTok/i.test(ua) ||
    /Line\//i.test(ua) ||
    /KAKAOTALK/i.test(ua) ||
    /GSA\//i.test(ua) ||            // Google Search App on iOS
    (/wv\)/.test(ua) && /Android/i.test(ua)) // generic Android WebView
  )
}

// Returns true when the app is running as an installed PWA in standalone mode on iOS.
// On iOS, loginRedirect() navigates to the CIAM domain (external origin) which iOS opens
// in Safari. After auth, CIAM redirects back to the PWA URL — but that loads in Safari,
// not the PWA shell. iOS 16.4+ gives the PWA a separate data store from Safari, so the
// MSAL account written in Safari is invisible to the PWA → the user returns to the login
// page unchanged. On Android this does not occur (shared storage); iOS-only workaround.
function isIosStandalone() {
  const ua = navigator.userAgent || ''
  const isIos = /iPhone|iPad|iPod/i.test(ua)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  return isIos && isStandalone
}

// Both providers run through the single CIAM sign-up/sign-in user flow. domain_hint asks
// CIAM to jump straight to that identity provider instead of showing the chooser page.
function Login() {
  const { instance } = useMsal()

  function signIn(domainHint) {
    instance.loginRedirect({
      ...loginRequest,
      extraQueryParameters: domainHint ? { domain_hint: domainHint } : undefined,
    })
  }

  const card = {
    maxWidth: 380, margin: '100px auto', padding: '48px 32px',
    textAlign: 'center', border: '1px solid #eee', borderRadius: '16px',
  }
  const logo = {
    width: '48px', height: '48px', borderRadius: '10px', background: '#534AB7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px', fontSize: '24px',
  }
  const providerButton = {
    width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px',
    fontWeight: '500', cursor: 'pointer', marginBottom: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  }
  const infoBox = {
    background: '#f5f4ff', borderRadius: '10px', padding: '20px',
    fontSize: '14px', color: '#444', lineHeight: '1.6', textAlign: 'left',
    marginBottom: '8px',
  }

  // In-app browser: the embedded browser cannot complete OAuth. Show a clear prompt.
  if (isInAppBrowser()) {
    return (
      <div style={card}>
        <div style={logo}>⚡</div>
        <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>QuizPulse</h1>
        <div style={{ ...infoBox, marginTop: '24px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>
            Please open in Safari or Chrome to sign in
          </strong>
          Sign-in doesn't work inside apps like Instagram, Facebook, or email clients.
          Copy the link below and paste it into Safari or Chrome.
        </div>
        <button
          data-testid="copy-link-button"
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href).catch(() => {})
          }}
          style={{
            ...providerButton, background: '#534AB7', color: 'white', border: 'none',
            marginTop: '8px',
          }}
        >
          Copy link
        </button>
      </div>
    )
  }

  // iOS standalone (home-screen PWA): loginRedirect() escapes to Safari and iOS's separate
  // data partition means the PWA never receives the auth result. Show guidance instead.
  if (isIosStandalone()) {
    return (
      <div style={card}>
        <div style={logo}>⚡</div>
        <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>QuizPulse</h1>
        <div style={{ ...infoBox, marginTop: '24px' }}>
          <strong style={{ display: 'block', marginBottom: '8px' }}>
            Sign in via Safari first
          </strong>
          To sign in from the home screen app on iPhone, open QuizPulse in Safari, sign in
          there, then return here. Your session will carry over.
        </div>
        <a
          data-testid="open-in-safari-link"
          href={window.location.href}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', width: '100%', padding: '12px', borderRadius: '8px',
            fontSize: '14px', fontWeight: '500', background: '#534AB7', color: 'white',
            textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
            marginTop: '8px',
          }}
        >
          Open in Safari
        </a>
      </div>
    )
  }

  // Standard browser: show the normal sign-in buttons.
  return (
    <div style={card}>
      <div style={logo}>⚡</div>
      <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>QuizPulse</h1>
      <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px' }}>Sign in to access the teacher dashboard</p>

      <button
        data-testid="login-microsoft"
        onClick={() => signIn('login.microsoftonline.com')}
        style={{ ...providerButton, background: '#534AB7', color: 'white', border: 'none' }}
      >
        Sign in with Microsoft
      </button>

      <button
        data-testid="login-google"
        onClick={() => signIn('google.com')}
        style={{ ...providerButton, background: 'white', color: '#444', border: '1px solid #ddd' }}
      >
        Sign in with Google
      </button>

      <button
        data-testid="login-chooser"
        onClick={() => signIn(null)}
        style={{ background: 'none', border: 'none', color: '#7B6EDE', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}
      >
        More sign-in options
      </button>
    </div>
  )
}

export default Login
