import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { adminLoginRequest } from '../authConfig.js'

export default function RequireAuth({ children }) {
  const isAuthenticated = useIsAuthenticated()
  const { instance, inProgress } = useMsal()

  if (inProgress !== 'none') {
    return <div style={{ padding: 32, color: '#666' }}>Signing in…</div>
  }

  if (!isAuthenticated) {
    instance.loginRedirect(adminLoginRequest).catch(console.error)
    return <div style={{ padding: 32, color: '#666' }}>Redirecting to sign in…</div>
  }

  return children
}
