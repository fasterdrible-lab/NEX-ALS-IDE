import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { ipc, type AppUser } from '../lib/ipc'

interface AuthState {
  user: AppUser | null
  needsSetup: boolean
  sessionRequired: boolean
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setup: (username: string, password: string) => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    needsSetup: false,
    sessionRequired: false,
    loading: true,
  })

  const refresh = async () => {
    try {
      const status = await ipc.auth.status()
      setState({ user: status.user, needsSetup: status.needsSetup, sessionRequired: status.sessionRequired, loading: false })
    } catch {
      setState(s => ({ ...s, loading: false }))
    }
  }

  useEffect(() => { void refresh() }, [])

  const login = async (username: string, password: string) => {
    const result = await ipc.auth.login(username, password)
    setState(s => ({ ...s, user: result.user, needsSetup: false }))
  }

  const logout = async () => {
    await ipc.auth.logout()
    setState(s => ({ ...s, user: null }))
  }

  const setup = async (username: string, password: string) => {
    const result = await ipc.auth.setup(username, password)
    setState(s => ({ ...s, user: result.user, needsSetup: false, sessionRequired: true }))
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setup, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
