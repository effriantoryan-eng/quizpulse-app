import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MsalProvider } from '@azure/msal-react'
import { msalInstance } from './msalInstance.js'
import { useIdleTimeout } from './session.js'
import AdminNav from './components/AdminNav.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import Schools from './pages/Schools.jsx'
import MergeTool from './pages/MergeTool.jsx'
import Institutions from './pages/Institutions.jsx'
import Monitoring from './pages/Monitoring.jsx'
import AuditLog from './pages/AuditLog.jsx'
import RoleManagement from './pages/RoleManagement.jsx'

const layoutStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
}

const mainStyle = {
  flex: 1,
  padding: '24px 32px',
  maxWidth: 1280,
  width: '100%',
  margin: '0 auto',
}

function AdminShell() {
  const [sessionWarning, setSessionWarning] = useState(false)

  useIdleTimeout({
    onWarn: () => setSessionWarning(true),
    onActivity: () => setSessionWarning(false),
    onTimeout: () => {
      msalInstance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
    },
  })

  return (
    <div style={layoutStyle}>
      <AdminNav sessionWarning={sessionWarning} />
      <main style={mainStyle}>
        <Routes>
          <Route path="/" element={<Navigate to="/schools" replace />} />
          <Route path="/schools" element={<Schools />} />
          <Route path="/schools/merge" element={<MergeTool />} />
          <Route path="/institutions" element={<Institutions />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/roles" element={<RoleManagement />} />
          <Route path="*" element={<Navigate to="/schools" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <RequireAuth>
          <AdminShell />
        </RequireAuth>
      </BrowserRouter>
    </MsalProvider>
  )
}
