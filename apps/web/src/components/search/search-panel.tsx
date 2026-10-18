'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { SearchInput } from '@/components/search/search-input'
import { SearchResults } from '@/components/search/search-results'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { orpc } from '@/lib/orpc'
import { formatDuration } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import Link from 'next/link'

export function SearchPanel() {
  const { status } = useAuth()
  const [term, setTerm] = useState('')
  const debouncedTerm = useDebouncedValue(term.trim(), 300)

  // queryKey, queryFn and types all come from the contract.
  const { data, error, isFetching } = useQuery(
    orpc.search.query.queryOptions({
      input: { q: debouncedTerm },
      enabled: status === 'authenticated' && debouncedTerm.length > 0,
    }),
  )

  if (status !== 'authenticated') {
    return (
      <div className="space-y-3 border-l-2 border-accent py-2 pl-4">
        <p className="font-medium">
          {status === 'loading' ? 'Checking your session…' : 'Sign in to search'}
        </p>
        {status === 'anonymous' && (
          <p className="text-sm text-ink-muted">
            <Link href="/login" className="text-accent underline-offset-4 hover:underline">Sign in</Link>
            {' '}or{' '}
            <Link href="/register" className="text-accent underline-offset-4 hover:underline">create an account</Link>
            {' '}to search indexed documents.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SearchInput value={term} onChange={setTerm} isLoading={isFetching} />

      {error && (
        <p className="rounded-xl border border-line bg-surface-muted p-4 text-sm">
          Search failed: {error.message}
          <span className="mt-1 block text-ink-muted">
            Is the API running on port 4000, and has the database been migrated and seeded?
          </span>
        </p>
      )}

      {data && (
        <>
          <p className="text-xs text-ink-muted tabular-nums">
            {data.total} result{data.total === 1 ? '' : 's'} · {formatDuration(data.tookMs)}
          </p>
          <SearchResults hits={data.hits} />
        </>
      )}

      {!data && !error && debouncedTerm.length === 0 && (
        <p className="text-sm text-ink-muted">Type to search the indexed documents.</p>
      )}
    </div>
  )
}
