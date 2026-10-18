'use client'

import { Spinner } from '@/components/ui/spinner'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  isLoading?: boolean
}

export function SearchInput({ value, onChange, isLoading = false }: SearchInputProps) {
  return (
    <div className="relative">
      <label htmlFor="search" className="sr-only">
        Search documents
      </label>
      <input
        id="search"
        type="search"
        value={value}
        autoFocus
        autoComplete="off"
        placeholder="Search documents…"
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-line bg-surface-muted px-4 py-3 pr-11 text-base outline-none placeholder:text-ink-muted focus:border-accent"
      />
      {isLoading && (
        <span className="absolute top-1/2 right-4 -translate-y-1/2">
          <Spinner />
        </span>
      )}
    </div>
  )
}
