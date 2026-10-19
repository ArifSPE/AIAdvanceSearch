'use client'

import { validateFilterValue, type ExecuteQueryResponse, type FilterValues, type SavedQuery } from '@ais/shared'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Copy, Database, FilePenLine, MoreHorizontal, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { client } from '@/lib/orpc'
import { QueryNameDialog } from './query-name-dialog'
import { QueryResultsTable } from './query-results-table'
import { FilterParameters } from './filter-parameters'

export function QueryLibrary({ onEdit, onNew }: { onEdit: (query: SavedQuery) => void; onNew: () => void }) {
  const queries = useQuery({ queryKey: ['saved-queries'], queryFn: () => client.savedQueries.list() })
  const [filter, setFilter] = useState('')
  const [openedId, setOpenedId] = useState<string | null>(null)
  const [execution, setExecution] = useState<ExecuteQueryResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ query: SavedQuery; mode: 'rename' | 'copy' | 'delete' } | null>(null)
  const [error, setError] = useState('')
  const [filterValues, setFilterValues] = useState<FilterValues>({})
  const opened = queries.data?.items.find((query) => query.id === openedId)
  const invalidFilters = opened?.filters.some((filter) => validateFilterValue(filter, Object.hasOwn(filterValues, filter.id) ? filterValues[filter.id]! : filter.defaultValue)) ?? false
  const visible = queries.data?.items.filter((query) => `${query.name} ${query.question} ${query.tableNames.join(' ')}`.toLowerCase().includes(filter.trim().toLowerCase())) ?? []

  function open(query: SavedQuery) { setOpenedId(query.id); setExecution(null); setError(''); setMenuId(null); setFilterValues({}) }
  async function run(query: SavedQuery) {
    setBusy(true); setError(''); setExecution(null)
    try { setExecution(await client.savedQueries.run({ id: query.id, filterValues })); await queries.refetch() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not run the saved query.') }
    finally { setBusy(false) }
  }
  const actions = (query: SavedQuery) => (
    <div className="relative shrink-0">
      <button type="button" disabled={busy} aria-label={`Actions for ${query.name}`} title="Query actions" aria-expanded={menuId === query.id}
        onClick={() => setMenuId(menuId === query.id ? null : query.id)} className="rounded-md p-2 hover:bg-surface-muted"><MoreHorizontal size={18} /></button>
      {menuId === query.id && (
        <>
          <button type="button" aria-label="Close query actions" onClick={() => setMenuId(null)} className="fixed inset-0 z-20 cursor-default" />
          <div className="absolute right-0 z-30 w-44 rounded-md border border-line bg-surface p-1 shadow-lg" onKeyDown={(event) => { if (event.key === 'Escape') setMenuId(null) }}>
            <button type="button" onClick={() => { setDialog({ query, mode: 'rename' }); setMenuId(null) }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-muted"><Pencil size={14} />Rename</button>
            <button type="button" onClick={() => onEdit(query)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-muted"><FilePenLine size={14} />Edit query</button>
            <button type="button" onClick={() => { setDialog({ query, mode: 'copy' }); setMenuId(null) }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm hover:bg-surface-muted"><Copy size={14} />Duplicate</button>
            <button type="button" onClick={() => { setDialog({ query, mode: 'delete' }); setMenuId(null) }} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-600 hover:bg-surface-muted"><Trash2 size={14} />Delete</button>
          </div>
        </>
      )}
    </div>
  )
  return (
    <section className="space-y-5" aria-label={opened ? 'Query workspace' : 'Query library'}>
      {opened ? (
        <>
          <button type="button" disabled={busy} onClick={() => { setOpenedId(null); setExecution(null); setError('') }} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={16} />Library</button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><h2 className="break-words text-xl font-semibold">{opened.name}</h2><p className="mt-1 text-sm text-ink-muted">{opened.question || opened.explanation}</p></div>
            <div className="flex items-center gap-2"><button type="button" disabled={busy || invalidFilters || !opened.plan} onClick={() => void run(opened)} className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Play size={16} />{busy ? 'Running...' : 'Run'}</button>{actions(opened)}</div>
          </div>
          {!opened.plan && <div role="status" className="border-l-2 border-amber-500 pl-3 text-sm">This legacy SQL query needs a validated plan. <button type="button" onClick={() => onEdit(opened)} className="text-accent underline">Edit and regenerate</button></div>}
          {opened.filters.length > 0 && <FilterParameters title="Run parameters" filters={opened.filters} values={filterValues} disabled={busy} onValuesChange={(values) => { setFilterValues(values); setExecution(null); setError('') }} />}
          <details className="border-y border-line py-3"><summary className="cursor-pointer text-sm text-ink-muted">Query details</summary>
            <p className="mt-3 text-sm text-ink-muted">{opened.explanation}</p>
            <pre className="mt-3 max-h-64 overflow-auto rounded-md bg-surface-muted p-3 text-xs whitespace-pre-wrap break-words"><code>{opened.sql}</code></pre>
            <p className="mt-2 break-all text-xs text-ink-muted">{opened.provider} · {opened.model}</p>
            <button type="button" disabled={busy} onClick={() => onEdit(opened)} className="mt-3 flex items-center gap-2 text-sm text-accent"><FilePenLine size={16} />Edit query</button>
          </details>
          {!execution && !busy && !error && <p className="py-10 text-center text-sm text-ink-muted">No results yet.</p>}
          {execution && <QueryResultsTable key={`${execution.queryToken}-${opened.id}`} result={execution.result} />}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Query library</h2><p className="text-xs text-ink-muted">{queries.data?.items.length ?? 0} saved queries</p></div><button type="button" onClick={onNew} className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white"><Plus size={16} />New query</button></div>
          <label className="flex items-center gap-2 rounded-md border border-line px-3 py-2.5 text-ink-muted"><Search size={16} /><span className="sr-only">Search saved queries</span><input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search queries" className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none" /></label>
          {queries.isPending && <p className="text-sm text-ink-muted">Loading queries...</p>}
          {!queries.isPending && !queries.error && visible.length === 0 && <div className="space-y-3 border-y border-line py-12 text-center"><Database size={28} className="mx-auto text-ink-muted" /><p className="text-sm text-ink-muted">{filter ? 'No matching queries.' : 'Your library is empty.'}</p>{!filter && <button type="button" onClick={onNew} className="text-sm font-medium text-accent">Create a query</button>}</div>}
          <div className="divide-y divide-line">{visible.map((query) => (
            <article key={query.id} className="flex items-center gap-3 py-4"><button type="button" onClick={() => open(query)} className="group min-w-0 flex-1 text-left"><span className="flex items-center gap-2 text-sm font-medium group-hover:text-accent"><span className="break-words">{query.name}</span><ArrowRight size={14} className="shrink-0 text-ink-muted" /></span><span className="mt-1 block truncate text-xs text-ink-muted">{query.question || query.explanation}</span><span className="mt-1 block text-xs text-ink-muted">{query.lastRunAt ? `Last run ${new Date(query.lastRunAt).toLocaleString()}` : 'Not run yet'}</span></button>{actions(query)}</article>
          ))}</div>
        </>
      )}
      {queries.error && <div role="alert" className="text-sm text-red-600">{queries.error.message} <button type="button" onClick={() => void queries.refetch()} className="underline">Retry</button></div>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {dialog && <QueryNameDialog key={`${dialog.mode}-${dialog.query.id}`} title={dialog.mode === 'rename' ? 'Rename query' : dialog.mode === 'copy' ? 'Save a copy' : 'Delete query'} destructive={dialog.mode === 'delete'} initialName={dialog.mode === 'copy' ? `${dialog.query.name.slice(0, 113)} (copy)` : dialog.query.name} submitLabel={dialog.mode === 'rename' ? 'Rename' : dialog.mode === 'copy' ? 'Save copy' : 'Delete query'} onClose={() => setDialog(null)} onSubmit={async (name) => {
        if (dialog.mode === 'rename') await client.savedQueries.update({ id: dialog.query.id, name })
        else if (dialog.mode === 'copy') await client.savedQueries.copy({ id: dialog.query.id, name })
        else { await client.savedQueries.remove({ id: dialog.query.id }); if (openedId === dialog.query.id) { setOpenedId(null); setExecution(null) } }
        await queries.refetch()
      }} />}
    </section>
  )
}