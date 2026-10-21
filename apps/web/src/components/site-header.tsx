'use client'

import Link from 'next/link'
import { useAuth } from '@/providers/auth-provider'

export function SiteHeader() {
  const { status, user, logout } = useAuth()

  return (
    <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-4 text-sm sm:gap-6 sm:px-6">
      <Link href="/" className="font-semibold">AI Advance Search</Link>
      <Link href="/search" className="text-ink-muted hover:text-ink">PostgreSQL Full-Text Search</Link>
      <Link href="/advanced-search" className="text-ink-muted hover:text-ink">Advanced DB Search</Link>
      {status === 'authenticated' && user?.role === 'IT-Admin' && <Link href="/admin" className="text-ink-muted hover:text-ink">Admin</Link>}
      <div className="ml-auto flex items-center gap-4">
        {status === 'loading' ? (
          <span className="text-ink-muted" aria-label="Checking sign-in status">…</span>
        ) : status === 'authenticated' ? (
          <>
            <span className="hidden max-w-48 truncate text-ink-muted sm:inline">{user?.email}</span>
            <button
              type="button"
              onClick={logout}
              className="font-medium hover:text-accent"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link href="/login" className="text-ink-muted hover:text-ink">Sign in</Link>
            <Link
              href="/register"
              className="rounded-lg bg-accent px-2.5 py-2 font-medium text-white hover:opacity-90 sm:px-3"
            >
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Create account</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}