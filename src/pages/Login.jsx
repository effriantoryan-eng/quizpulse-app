import { useMsal } from '@azure/msal-react'
import { loginRequest } from '../authConfig'

function Login() {
  const { instance } = useMsal()

  function handleLogin() {
    instance.loginRedirect(loginRequest)
  }

  return (
    <div style={{ maxWidth: 380, margin: '100px auto', padding: '48px 32px', textAlign: 'center', border: '1px solid #eee', borderRadius: '16px' }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#534AB7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '24px' }}>⚡</div>
      <h1 style={{ fontSize: '22px', fontWeight: '500', marginBottom: '8px' }}>QuizPulse</h1>
      <p style={{ fontSize: '14px', color: '#888', marginBottom: '32px' }}>Sign in to access the teacher dashboard</p>
      <button
        onClick={handleLogin}
        style={{ width: '100%', padding: '12px', background: '#534AB7', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
      >
        Sign in with Microsoft
      </button>
    </div>
  )
}

export default Login