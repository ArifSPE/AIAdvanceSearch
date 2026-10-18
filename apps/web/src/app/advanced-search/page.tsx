import type { Metadata } from 'next'
import { AdvancedSearchPanel } from '@/components/search/advanced-search-panel'

export const metadata: Metadata = { title: 'Advanced search · AI Advance Search' }

export default function AdvancedSearchPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Schema explorer</p>
        <h1 className="text-2xl font-semibold">Advanced search</h1>
      </div>
      <AdvancedSearchPanel />
    </div>
  )
}