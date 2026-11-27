import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore, unwrap, type User } from '../api/client'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(tokenStore.get())

  const me = useQuery({
    queryKey: ['me', token],
    queryFn: () => unwrap(api.GET('/auth/me')),
    enabled: token !== null,
    retry: false,
    staleTime: 60_000,
  })

  const startSession = useCallback(
    (newToken: string) => {
      tokenStore.set(newToken)
      setToken(newToken)
      queryClient.clear()
    },
    [queryClient],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const session = await unwrap(api.POST('/auth/login', { body: { email, password } }))
      startSession(session.token)
    },
    [startSession],
  )

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const session = await unwrap(api.POST('/auth/register', { body: { name, email, password } }))
      startSession(session.token)
    },
    [startSession],
  )

  const logout = useCallback(() => {
    tokenStore.clear()
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthState>(
    () => ({
      user: token && me.data ? me.data : null,
      loading: token !== null && me.isPending && !me.isError,
      login,
      register,
      logout,
    }),
    [token, me.data, me.isPending, me.isError, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
