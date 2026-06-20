import { useEffect, useState } from 'react'
import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { adminLoginRequest } from '../authConfig.js'

export default function RequireAuth({ children }) {
  const isAuthenticated = useIsAuthenticated()
  const { instance, inProgress } = useMsal()
  const [redirectFailed, setRedirectFailed] = useState(false)

  useEffect(() => {
    if (!isAuthenticated && inProgress === 'none') {
      instance.loginRedirect(adminLoginRequest).catch(() => setRedirectFailed(true))
    }
  }, [isAuthenticated, inProgress, instance])

  if (inProgress !== 'none') {
    return <div style={{ padding: 32, color: '#666' }}>Signing in…</div>
  }

  if (!isAuthenticated) {
    if (redirectFailed) {
      return <div style={{ padding: 32, color: '#c0392b' }}>Sign-in redirect failed. Refresh the page to try again.</div>
    }
    return <div style={{ padding: 32, color: '#666' }}>Redirecting to sign in…</div>
  }

  return children
}
