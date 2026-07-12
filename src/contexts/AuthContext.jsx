import { createContext, useContext, useMemo } from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { loginRequest } from '../authConfig'
import { DEV_AUTH_BYPASS, devAuthUser } from '../devAuth'

const AuthContext = createContext(null)

// Provides the same { user, teacherId, loading } shape downstream components already rely on,
// now backed by Azure AD B2C (MSAL) instead of a localStorage UUID. teacherId is the B2C
// object id (oid) — stable per user across Microsoft/Google sign-ins.
export function AuthProvider({ children }) {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  const value = useMemo(() => {
    if (DEV_AUTH_BYPASS) return devAuthUser
    const account = accounts[0] || instance.getActiveAccount() || null
    const claims = account?.idTokenClaims || {}
    const teacherId = isAuthenticated
      ? (claims.oid || claims.sub || account?.localAccountId || null)
      : null
    const user = account
      ? {
          name: claims.name || account.name || null,
          email: claims.emails?.[0] || claims.email || account.username || null,
          idp: claims.idp || 'local',
        }
      : null

    return {
      user,
      teacherId,
      loading: inProgress !== InteractionStatus.None,
      isAuthenticated,
      login: (request) => instance.loginRedirect(request || loginRequest),
      logout: () => instance.logoutRedirect(),
    }
  }, [accounts, inProgress, isAuthenticated, instance])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
