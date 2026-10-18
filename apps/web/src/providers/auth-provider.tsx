'use client'

import type { AuthenticatedUser, LoginInput, RegisterInput } from '@ais/shared'
import { useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { client } from '@/lib/orpc'

const ACCESS_TOKEN_KEY = 'ais_access_token'

type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

interface AuthContextValue {
  status: AuthStatus
  user: AuthenticatedUser | null
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthenticatedUser | null>(null)

  useEffect(() => {
    const token = window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token) {
      setStatus('anonymous')
      return
    }

    let cancelled = false
    client.auth.me()
      .then((authenticatedUser) => {
        if (cancelled) return
        setUser(authenticatedUser)
        setStatus('authenticated')
      })
      .catch(() => {
        window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
        if (cancelled) return
        setUser(null)
        setStatus('anonymous')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function login(input: LoginInput) {
    const session = await client.auth.login(input)
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
    setUser(session.user)
    setStatus('authenticated')
    queryClient.clear()
  }

  async function register(input: RegisterInput) {
    const session = await client.auth.register(input)
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken)
    setUser(session.user)
    setStatus('authenticated')
    queryClient.clear()
  }

  function logout() {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }

  return (
    <AuthContext.Provider value={{ status, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}