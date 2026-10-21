import type { Metadata } from 'next'
import { SearchPanel } from '@/components/search/search-panel'

export const metadata: Metadata = {
  title: 'PostgreSQL Full-Text Search · AI Advance Search',
}

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">PostgreSQL Full-Text Search</h1>
      <SearchPanel />
    </div>
  )
}
