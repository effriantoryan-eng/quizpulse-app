import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'

// Both providers run through the single B2C sign-up/sign-in user flow. domain_hint asks B2C
// to jump straight to that identity provider instead of showing the chooser page.
function Login() {
  const { instance } = useMsal()

  function signIn(domainHint) {
    instance.loginRedirect({
      ...loginRequest,
      extraQueryParameters: domainHint ? { domain_hint: domainHint } : undefined,
    })
  }

  const providerButton = {
    width: '100%', padding: '12px', borderRadius: '8px', fontSize: '14px',
    fontWeight: '500', cursor: 'pointer', marginBottom: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  }

  return (
    <div style={{ maxWidth: 380, margin: '100px auto', padding: '48px 32px', textAlign: 'center', border: '1px solid #eee', borderRadius: '16px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>⚡</div>
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
