import { createContext, useContext, useState, useEffect } from 'react'
import { getSessionId } from '../session'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [teacherId, setTeacherId] = useState(null)

  useEffect(() => {
    setTeacherId(getSessionId('quizpulse_teacher_id'))
  }, [])

  return (
    <AuthContext.Provider value={{ teacherId }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
