import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '@/services/patientApi'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lp_user')) } catch { return null }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('lp_access_token')
    if (token && !user) {
      authApi.me()
        .then(({ data }) => setUser(data.user))
        .catch(() => clearAuth())
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await authApi.login({ email, password })
    localStorage.setItem('lp_access_token', data.access_token)
    localStorage.setItem('lp_refresh_token', data.refresh_token)
    localStorage.setItem('lp_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (name, email, password, role = 'patient', phone = '') => {
    const { data } = await authApi.register({ name, email, password, role, phone })
    localStorage.setItem('lp_access_token', data.access_token)
    localStorage.setItem('lp_refresh_token', data.refresh_token)
    localStorage.setItem('lp_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try { await authApi.logout() } catch {}
    clearAuth()
  }, [])

  const clearAuth = () => {
    localStorage.removeItem('lp_access_token')
    localStorage.removeItem('lp_refresh_token')
    localStorage.removeItem('lp_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
