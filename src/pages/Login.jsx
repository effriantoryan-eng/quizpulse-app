import { useEffect, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { loginRequest, signUpRequest } from '../authConfig'

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
  const [authError, setAuthError] = useState(null)

  // main.jsx stashes a hint here when a sign-in/sign-up redirect comes back with an error,
  // so the user sees something actionable instead of silently landing back on this page.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('qp_auth_error')
      if (stored) {
        setAuthError(stored)
        sessionStorage.removeItem('qp_auth_error')
      }
    } catch { /* sessionStorage unavailable */ }
  }, [])

  function signIn(domainHint) {
    instance.loginRedirect({
      ...loginRequest,
      extraQueryParameters: domainHint ? { domain_hint: domainHint } : undefined,
    })
  }

  // prompt: 'create' tells CIAM to show the account-creation form rather than the
  // sign-in form. Uses the same authority and redirect URI as sign-in — no extra
  // portal config needed beyond enabling self-service sign-up on the external tenant.
  function signUp() {
    instance.loginRedirect(signUpRequest)
  }

  const card = {
    maxWidth: 400, margin: '80px auto', padding: '44px 32px',
    textAlign: 'center', background: 'var(--surface)',
    border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
  }
  const logo = {
    width: '52px', height: '52px', borderRadius: '12px', background: 'var(--logoGrad)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
    margin: '0 auto 20px', fontSize: '26px',
    border: 'var(--bw) solid var(--border)', boxShadow: 'var(--shadowField)',
  }
  const providerButton = {
    width: '100%', padding: '14px', borderRadius: 'var(--radius)', fontSize: '15px',
    fontWeight: '700', cursor: 'pointer', marginBottom: '12px',
    fontFamily: 'var(--heading)',
    border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  }
  const infoBox = {
    background: 'var(--tipBg)', border: 'var(--bw) solid var(--border)',
    borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: '20px',
    fontSize: '14px', color: 'var(--text)', lineHeight: '1.6', textAlign: 'left',
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
            ...providerButton, background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)',
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
            Sign in or create an account via Safari first
          </strong>
          To sign in or sign up from the home screen app on iPhone, open QuizPulse in Safari,
          complete sign-in or account creation there, then return here. Your session will carry over.
        </div>
        <a
          data-testid="open-in-safari-link"
          href={window.location.href}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', width: '100%', padding: '12px', borderRadius: '8px',
            fontSize: '14px', fontWeight: '500', background: 'var(--primary)', color: 'white',
            textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
            marginTop: '8px',
          }}
        >
          Open in Safari
        </a>
      </div>
    )
  }

  // Standard browser: show the normal sign-in buttons + sign-up section.
  return (
    <div style={card}>
      <div style={logo}>⚡</div>
      <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>QuizPulse</h1>
      <p style={{ fontSize: '14px', color: '#888', marginBottom: authError ? '16px' : '32px' }}>Sign in to access the teacher dashboard</p>

      {authError && (
        <div
          data-testid="auth-error"
          style={{
            background: 'var(--dangerBg)', color: 'var(--danger)',
            border: 'var(--bw) solid var(--border)', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)', padding: '12px 14px', marginBottom: '20px',
            fontSize: '13px', textAlign: 'left', lineHeight: '1.5',
          }}
        >
          That didn't go through. Please try again — if you're new, use <strong>Create an account</strong> below to register first.
        </div>
      )}

      <button
        data-testid="login-microsoft"
        onClick={() => signIn('login.microsoftonline.com')}
        style={{ ...providerButton, background: 'var(--primary)', color: 'white', border: 'var(--bw) solid var(--border)', boxShadow: 'var(--btnShadow)' }}
      >
        Sign in with Microsoft
      </button>

      <button
        data-testid="login-google"
        onClick={() => signIn('google.com')}
        style={{ ...providerButton, background: 'white', color: 'var(--text)' }}
      >
        Sign in with Google
      </button>

      <button
        data-testid="login-chooser"
        onClick={() => signIn(null)}
        style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '13px', cursor: 'pointer', marginTop: '6px' }}
      >
        More sign-in options
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0 20px' }}>
        <div style={{ flex: 1, height: '1px', background: '#eee' }} />
        <span style={{ fontSize: '12px', color: '#bbb', whiteSpace: 'nowrap' }}>New to QuizPulse?</span>
        <div style={{ flex: 1, height: '1px', background: '#eee' }} />
      </div>

      <button
        data-testid="signup-button"
        onClick={signUp}
        style={{ ...providerButton, background: 'var(--primarySoft)', color: 'var(--text)', border: 'var(--bw) solid var(--primary)', marginBottom: 0 }}
      >
        Create an account
      </button>
    </div>
  )
}

export default Login
