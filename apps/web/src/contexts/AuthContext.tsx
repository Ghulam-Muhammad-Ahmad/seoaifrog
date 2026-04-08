import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { apiFetch } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
  name?: string | null
  plan?: string
  createdAt?: string
  /** Optional profile image URL from API. */
  avatar?: string | null
}

interface AuthMeResponse {
  user: AuthUser
}

async function fetchMe(): Promise<AuthUser | null> {
  const res = await apiFetch('/api/auth/me', { method: 'GET' })
  if (res.status === 401 || res.status === 403) return null
  if (!res.ok) return null
  const data = (await res.json()) as AuthMeResponse
  return data?.user ?? null
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  refetch: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  })

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' })
    } catch {
      /* ignore */
    }
    queryClient.setQueryData(['auth', 'me'], null)
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading,
      isAuthenticated: Boolean(user),
      refetch: () => {
        void refetch()
      },
      logout,
    }),
    [user, isLoading, refetch, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
