import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { setAuthFailureHandler, tokenStore } from '../api/client'
import { authApi } from '../api/endpoints'
import type { Me } from '../api/types'

interface AuthState {
  user: Me | undefined
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !!tokenStore.access,
    retry: false,
    staleTime: Infinity,
  })

  const logout = useCallback(() => {
    tokenStore.clear()
    queryClient.clear()
    queryClient.setQueryData(['me'], undefined)
  }, [queryClient])

  useEffect(() => setAuthFailureHandler(logout), [logout])

  const login = useCallback(
    async (username: string, password: string) => {
      const tokens = await authApi.login(username, password)
      tokenStore.set(tokens.access, tokens.refresh)
      await queryClient.fetchQuery({ queryKey: ['me'], queryFn: authApi.me })
    },
    [queryClient],
  )

  const value = useMemo(
    () => ({ user, isLoading: isLoading && !!tokenStore.access, login, logout }),
    [user, isLoading, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
