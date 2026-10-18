'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/auth-provider'

type AuthMode = 'login' | 'register'

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter()
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isRegister = mode === 'register'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setIsSubmitting(true)

    try {
      if (isRegister) {
        await auth.register({ email, name: name.trim() || undefined, password })
      } else {
        await auth.login({ email, password })
      }
      router.replace('/search')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Authentication failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="w-full max-w-md">
      <div className="mb-8 border-l-2 border-accent pl-5">
        <p className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          AI Advance Search
        </p>
        <h1 className="text-3xl font-semibold">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {isRegister
            ? 'Sign up to search your indexed knowledge.'
            : 'Sign in to continue to your searchable workspace.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {isRegister && (
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">Name</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            maxLength={320}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input
            id="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 12 : 1}
            maxLength={72}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent"
          />
          {isRegister && <p className="text-xs text-ink-muted">Use at least 12 characters.</p>}
        </div>

        {errorMessage && (
          <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2.5 text-sm">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-muted">
        {isRegister ? 'Already have an account? ' : 'New to AI Advance Search? '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-medium text-accent underline-offset-4 hover:underline"
        >
          {isRegister ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </section>
  )
}