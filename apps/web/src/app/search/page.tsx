import type { Metadata } from 'next'
import { SearchPanel } from '@/components/search/search-panel'

export const metadata: Metadata = {
  title: 'Search · AI Advance Search',
}

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      <SearchPanel />
    </div>
  )
}
