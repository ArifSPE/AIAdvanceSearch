'use client'

import { defineQueryFilter, filterInputType, validateFilterValue, type ExecuteQueryResponse, type FilterValues, type GeneratedQuery, type LlmProvider, type QueryFilter, type SavedQuery } from '@ais/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useId, useState } from 'react'
import { ArrowLeft, Check, Copy, Play, Save, Sparkles } from 'lucide-react'
import { useAuth } from '@/providers/auth-provider'
import { client } from '@/lib/orpc'
import { EntityDiagram } from './entity-diagram'
import { OutputOrderList } from './output-order-list'
import { QueryResultsTable } from './query-results-table'
import { QueryLibrary } from './query-library'
import { QueryNameDialog } from './query-name-dialog'
import { FilterParameters } from './filter-parameters'

interface PickerOption {
  id: string
  label: string
  detail: string
  searchText: string
}

interface MultiSelectPickerProps {
  label: string
  placeholder: string
  options: PickerOption[]
  selectedIds: string[]
  disabled?: boolean
  onToggle: (id: string) => void
}

function MultiSelectPicker({
  label,
  placeholder,
  options,
  selectedIds,
  disabled = false,
  onToggle,
}: MultiSelectPickerProps) {
  const listId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const visibleOptions = options.filter((option) =>
    `${option.label} ${option.detail} ${option.searchText}`.toLowerCase().includes(filter.trim().toLowerCase()),
  )

  return (
    <div className="relative space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium text-ink">{label}</label>
        <span className="text-xs tabular-nums text-ink-muted">
          {selectedIds.length} selected
        </span>
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => {
          setIsOpen((open) => !open)
          setFilter('')
        }}
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm outline-none transition-colors hover:border-accent focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selectedIds.length ? 'text-ink' : 'text-ink-muted'}>{placeholder}</span>
        <span aria-hidden="true" className="text-xs text-ink-muted">{isOpen ? 'Close' : 'Choose'}</span>
      </button>

      {isOpen && !disabled && (
        <div
          id={listId}
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-xl"
        >
          <div className="border-b border-line p-2">
            <label className="sr-only">Filter {label.toLowerCase()}</label>
            <input
              type="search"
              autoFocus
              autoComplete="off"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsOpen(false)
              }}
              placeholder={`Type to filter ${label.toLowerCase()}…`}
              className="w-full rounded-md border border-line bg-surface-muted px-3 py-2 text-sm outline-none placeholder:text-ink-muted focus:border-accent"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-4 text-sm text-ink-muted">No matches.</p>
            ) : (
              visibleOptions.map((option) => {
                const checked = selectedIds.includes(option.id)
                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 hover:bg-surface-muted"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(option.id)}
                      className="mt-0.5 size-4 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{option.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {option.detail}
                      </span>
                    </span>
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function AdvancedSearchPanel() {
  const { status } = useAuth()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'library' | 'builder'>('library')
  const [editingQuery, setEditingQuery] = useState<SavedQuery | null>(null)
  const [saveDialog, setSaveDialog] = useState<'save' | 'copy' | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [draftOutputOrder, setDraftOutputOrder] = useState<string[]>([])
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([])
  const [outputColumnIds, setOutputColumnIds] = useState<string[]>([])
  const [question, setQuestion] = useState('')
  const [filters, setFilters] = useState<QueryFilter[]>([])
  const [filtersReviewed, setFiltersReviewed] = useState(false)
  const [isRecommendingFilters, setIsRecommendingFilters] = useState(false)
  const [filterError, setFilterError] = useState('')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isRecommending, setIsRecommending] = useState(false)
  const [recommendError, setRecommendError] = useState('')
  const [recommendationNote, setRecommendationNote] = useState<{ explanation: string; source: string } | null>(null)
  const [generatedQuery, setGeneratedQuery] = useState<GeneratedQuery | null>(null)
  const [execution, setExecution] = useState<ExecuteQueryResponse | null>(null)
  const [generationError, setGenerationError] = useState('')
  const [executionError, setExecutionError] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const schemaQuery = useQuery({
    queryKey: ['metadata', 'schema'],
    queryFn: () => client.metadata.schema(),
    enabled: status === 'authenticated',
  })
  const providersQuery = useQuery({
    queryKey: ['llm', 'providers'],
    queryFn: () => client.llm.providers(),
    enabled: status === 'authenticated',
  })
  const promptsQuery = useQuery({
    queryKey: ['prompts'],
    queryFn: () => client.prompts.list(),
    enabled: status === 'authenticated',
  })
  const prompts = promptsQuery.data?.items ?? []
  const promptLibrary = [...new Set(prompts.map((prompt) => prompt.category))].map((category) => ({
    category,
    prompts: prompts.filter((prompt) => prompt.category === category),
  }))
  const [chosenProvider, setChosenProvider] = useState<LlmProvider | null>(null)
  const [chosenModel, setChosenModel] = useState<string | null>(null)
  const providerOptions = providersQuery.data?.providers ?? []
  const provider = chosenProvider ?? providersQuery.data?.defaultProvider
  const selectedProvider = providerOptions.find((option) => option.id === provider)
  const model = chosenModel ?? selectedProvider?.model

  const availableTables = schemaQuery.data?.tables ?? []
  const selectedTables = availableTables.filter((table) => selectedTableIds.includes(table.id))
  const invalidFilters = filters.some((filter) => validateFilterValue(filter, filter.defaultValue))
  const filterValues: FilterValues = Object.fromEntries(filters.map((filter) => [filter.id, filter.defaultValue]))
  const columnById = new Map(
    selectedTables.flatMap((table) => table.columns.map((column) => [column.id, { table, column }] as const)),
  )
  const orderedOutput = outputColumnIds.flatMap((id) => columnById.get(id) ?? [])
  const hasTableWithoutColumns = selectedTables.some(
    (table) => !orderedOutput.some((entry) => entry.table.id === table.id),
  )
  const outputItems = orderedOutput.map(({ table, column }) => ({
    id: column.id,
    label: `${table.display_name} › ${column.display_name}`,
    detail: `${table.name}.${column.name}`,
  }))
  const tableOptions: PickerOption[] = availableTables.map((table) => ({
    id: table.id,
    label: table.display_name,
    detail: `${table.name} · ${table.columns.length} columns · ${table.description}`,
    searchText: table.columns.map((column) => `${column.display_name} ${column.name}`).join(' '),
  }))
  function resetResults() {
    setHasUnsavedChanges(true)
    setSaveMessage('')
    setSaveError('')
    setGeneratedQuery(null)
    setExecution(null)
    setGenerationError('')
    setExecutionError('')
  }

  function toggleTable(id: string) {
    resetResults()
    setFiltersReviewed(false)
    const isSelected = selectedTableIds.includes(id)
    const table = availableTables.find((candidate) => candidate.id === id)
    const tableColumnIds = new Set(table?.columns.map((column) => column.id))
    const primaryKeyIds = table?.columns.filter((column) => column.is_primary_key).map((column) => column.id) ?? []
    if (isSelected) setFilters((current) => current.filter((filter) => filter.table !== table?.name))
    setSelectedTableIds((current) =>
      isSelected ? current.filter((tableId) => tableId !== id) : [...current, id],
    )
    setOutputColumnIds((current) =>
      isSelected ? current.filter((columnId) => !tableColumnIds.has(columnId)) : [...current, ...primaryKeyIds],
    )
  }

  function toggleColumn(id: string) {
    resetResults()
    setOutputColumnIds((current) =>
      current.includes(id) ? current.filter((columnId) => columnId !== id) : [...current, id],
    )
  }

  /** Puts a column at `index` in the output order, whether it is new or already listed. */
  function placeColumn(id: string, index: number) {
    if (!columnById.has(id)) return
    resetResults()
    setOutputColumnIds((current) => {
      const sourceIndex = current.indexOf(id)
      const without = current.filter((columnId) => columnId !== id)
      const target = sourceIndex >= 0 && sourceIndex < index ? index - 1 : index
      without.splice(Math.max(0, Math.min(target, without.length)), 0, id)
      return without
    })
  }

  async function recommendSelection() {
    setRecommendError('')
    setIsRecommending(true)
    try {
      const recommendation = await client.llm.recommendSelection({
        question: question.trim(),
        provider,
        model,
      })
      const tablesByName = new Map(availableTables.map((table) => [table.name, table]))
      const tableIds = recommendation.tables.flatMap((entry) => tablesByName.get(entry.name)?.id ?? [])
      const columnIds = recommendation.outputOrder.flatMap((qualifiedName) => {
        const [tableName, columnName] = qualifiedName.split('.')
        const column = tablesByName.get(tableName ?? '')?.columns.find((candidate) => candidate.name === columnName)
        return column ? [column.id] : []
      })

      resetResults()
      setSelectedTableIds(tableIds)
      setOutputColumnIds(columnIds)
      setFilters(recommendation.filters)
      setFiltersReviewed(true)
      setFilterError('')
      setRecommendationNote({
        explanation: recommendation.explanation,
        source: `${recommendation.provider} · ${recommendation.model}`,
      })
      setIsHelpOpen(true)
    } catch (error) {
      setRecommendError(error instanceof Error ? error.message : 'Could not suggest a selection.')
    } finally {
      setIsRecommending(false)
    }
  }

  async function generateQuery() {
    setGenerationError('')
    setExecutionError('')
    setGeneratedQuery(null)
    setExecution(null)
    setIsGenerating(true)

    try {
      const tables = selectedTables.map((table) => ({
        name: table.name,
        columns: orderedOutput
          .filter((entry) => entry.table.id === table.id)
          .map((entry) => entry.column.name),
      }))
      const outputOrder = orderedOutput.map(({ table, column }) => `${table.name}.${column.name}`)
      const generated = await client.llm.generateQuery({ question: question.trim(), provider, model, outputOrder, tables, filters })
      setGeneratedQuery(generated)
      setHasUnsavedChanges(true)
      setDraftOutputOrder(outputOrder)
      setSaveName(editingQuery?.name ?? question.trim().slice(0, 120))
      setSaveMessage('')
      setSaveError('')
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Could not generate a query.')
    } finally {
      setIsGenerating(false)
    }
  }

  async function executeQuery() {
    if (!generatedQuery) return
    setExecutionError('')
    setExecution(null)
    setIsExecuting(true)

    try {
      setExecution(await client.llm.executeQuery({ queryToken: generatedQuery.queryToken, filterValues }))
    } catch (error) {
      setExecutionError(error instanceof Error ? error.message : 'Could not execute the query.')
    } finally {
      setIsExecuting(false)
    }
  }

  async function saveQuery(name: string) {
    if (!generatedQuery) return
    setIsSaving(true)
    setSaveError('')
    setSaveMessage('')
    try {
      const input = { name, queryToken: generatedQuery.queryToken, outputOrder: draftOutputOrder, filterValues }
      const saved = editingQuery && saveDialog !== 'copy'
        ? await client.savedQueries.update({ ...input, id: editingQuery.id })
        : await client.savedQueries.save(input)
      setEditingQuery(saved)
      setSaveName(saved.name)
      setSaveMessage('Saved')
      setHasUnsavedChanges(false)
      await queryClient.invalidateQueries({ queryKey: ['saved-queries'] })
    } catch (cause) {
      throw cause
    } finally {
      setIsSaving(false)
    }
  }

  function openSavedQuery(saved: SavedQuery, response?: ExecuteQueryResponse) {
    resetResults()
    setQuestion(saved.question)
    setChosenProvider(saved.provider)
    setChosenModel(saved.model)
    setSelectedTableIds(availableTables.filter((table) => saved.tableNames.includes(table.name)).map((table) => table.id))
    setOutputColumnIds(saved.outputOrder.flatMap((qualifiedName) => {
      const [tableName, columnName] = qualifiedName.split('.')
      return availableTables.find((table) => table.name === tableName)?.columns.find((column) => column.name === columnName)?.id ?? []
    }))
    setDraftOutputOrder(saved.outputOrder)
    setFilters(saved.filters)
    setFiltersReviewed(true)
    setFilterError('')
    setSaveName(saved.name)
    setRecommendationNote(null)
    setEditingQuery(saved)
    setHasUnsavedChanges(false)
    setView('builder')
    setIsHelpOpen(true)
    if (response) {
      setGeneratedQuery(response)
      setExecution(response)
    }
  }

  function newQuery() {
    resetResults()
    setEditingQuery(null)
    setSelectedTableIds([])
    setOutputColumnIds([])
    setFilters([])
    setFiltersReviewed(false)
    setFilterError('')
    setQuestion('')
    setSaveName('')
    setRecommendationNote(null)
    setIsHelpOpen(false)
    setView('builder')
    setHasUnsavedChanges(false)
  }

  async function recommendFilters() {
    setIsRecommendingFilters(true)
    setFilterError('')
    try {
      const recommendation = await client.llm.recommendSelection({ question: question.trim(), provider, model, tableNames: selectedTables.map((table) => table.name) })
      resetResults()
      setFilters(recommendation.filters)
      setFiltersReviewed(true)
    } catch (error) { setFilterError(error instanceof Error ? error.message : 'Could not recommend filters.') }
    finally { setIsRecommendingFilters(false) }
  }

  if (status === 'loading') {
    return <p className="text-sm text-ink-muted">Checking your session…</p>
  }

  if (status === 'anonymous') {
    return (
      <div className="space-y-3 border-l-2 border-accent py-2 pl-4">
        <p className="font-medium">Sign in to load database metadata.</p>
        <p className="text-sm text-ink-muted">
          <Link href="/login" className="text-accent underline-offset-4 hover:underline">Sign in</Link>
          {' '}or{' '}
          <Link href="/register" className="text-accent underline-offset-4 hover:underline">create an account</Link>
          {' '}to build a query selection.
        </p>
      </div>
    )
  }

  if (view === 'library') {
    return <QueryLibrary onEdit={openSavedQuery} onNew={newQuery} />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={isGenerating || isRecommending || isRecommendingFilters || isSaving || isExecuting} onClick={() => {
          if (!hasUnsavedChanges || window.confirm('Leave the builder? Unsaved changes will be discarded.')) {
            setHasUnsavedChanges(false)
            setView('library')
          }
        }} className="flex items-center gap-2 text-sm text-ink-muted hover:text-ink"><ArrowLeft size={16} />Library</button>
        <h2 className="min-w-0 break-words text-sm font-semibold">{editingQuery ? `Editing: ${editingQuery.name}` : 'New query'}</h2>
      </div>
      <section className="space-y-3" aria-labelledby="describe-heading">
        <h3 id="describe-heading" className="text-sm font-semibold">1. Describe</h3>
        <label htmlFor="prompt-library" className="block space-y-1.5 text-sm">
          <span className="text-ink-muted">Prompt library</span>
          <select
            id="prompt-library"
            value={promptLibrary.flatMap((group) => group.prompts).some((prompt) => prompt.question === question) ? question : ''}
            disabled={promptsQuery.isPending || prompts.length === 0 || isRecommending || isRecommendingFilters || isGenerating || isExecuting || isSaving}
            onChange={(event) => {
              if (!event.target.value) return
              setQuestion(event.target.value)
              resetResults()
              setRecommendError('')
              setRecommendationNote(null)
              setFilters([])
              setFiltersReviewed(false)
              setFilterError('')
            }}
            className="w-full min-w-0 rounded-md border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
          >
            <option value="">{promptsQuery.isPending ? 'Loading prompts...' : question ? 'Custom question' : prompts.length ? 'Choose a prompt' : 'No published prompts'}</option>
            {promptLibrary.map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.prompts.map((prompt) => <option key={prompt.id} value={prompt.question}>{prompt.label}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {promptsQuery.error && <p role="alert" className="text-xs text-red-600">Prompt library unavailable. <button type="button" onClick={() => void promptsQuery.refetch()} className="underline">Retry</button></p>}
        <label htmlFor="query-question" className="sr-only">What should this query find?</label>
        <textarea id="query-question" value={question} disabled={isRecommending || isRecommendingFilters || isGenerating || isExecuting || isSaving} onChange={(event) => { setQuestion(event.target.value); setFiltersReviewed(false); resetResults() }} maxLength={2000} rows={3}
          placeholder="Which borrowers have missed loan payments?"
          className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent" />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={recommendSelection} disabled={isRecommending || isRecommendingFilters || isGenerating || isExecuting || isSaving || question.trim().length < 3 || !selectedProvider?.available || availableTables.length === 0}
            className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"><Sparkles size={16} />{isRecommending ? 'Finding selection...' : 'Suggest selection'}</button>
          <button type="button" onClick={() => setIsHelpOpen(!isHelpOpen)} className="text-sm text-accent">Choose manually</button>
        </div>
        {recommendError && <p role="alert" className="text-sm text-red-600">{recommendError}</p>}
      </section>
      <details open={isHelpOpen} onToggle={(event) => setIsHelpOpen(event.currentTarget.open)} className="border-t border-line pt-5">
        <summary className="cursor-pointer text-sm font-semibold">2. Review selection <span className="font-normal text-ink-muted">({selectedTables.length} tables, {orderedOutput.length} columns)</span></summary>
      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <MultiSelectPicker
              label="Tables"
              placeholder="Select one or more tables"
              options={tableOptions}
              selectedIds={selectedTableIds}
              disabled={isRecommending || isRecommendingFilters || isGenerating || isExecuting || isSaving}
              onToggle={toggleTable}
            />
          </div>
        </div>


        {recommendationNote && (
          <div role="status" className="flex items-start gap-3 border-l-2 border-accent py-1 pl-4">
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="font-medium">Suggested selection applied. Review the diagram and output order, then generate SQL.</p>
              <p className="text-ink-muted">{recommendationNote.explanation}</p>
              <p className="truncate text-xs text-ink-muted">{recommendationNote.source}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss suggestion note"
              onClick={() => setRecommendationNote(null)}
              className="rounded px-1.5 py-1 text-xs text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              ✕
            </button>
          </div>
        )}
      </section>

      {schemaQuery.isPending && <p className="text-sm text-ink-muted">Loading table metadata…</p>}
      {schemaQuery.error && (
        <p role="alert" className="border-l-2 border-red-500 py-2 pl-4 text-sm">
          Could not load schema metadata: {schemaQuery.error.message}
        </p>
      )}

      <section
        aria-labelledby="selection-heading"
        className="relative left-1/2 w-[min(80rem,calc(100vw-3rem))] -translate-x-1/2 space-y-4 border-t border-line pt-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="selection-heading" className="text-sm font-semibold">Entity diagram</h2>
          <span className="text-xs tabular-nums text-ink-muted">
            {selectedTables.length} tables · {orderedOutput.length} output columns
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          Drag columns from a table into the output order, or click a column to add or remove it.
        </p>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <EntityDiagram
            tables={selectedTables}
            outputColumnIds={outputColumnIds}
            onToggleColumn={toggleColumn}
          />
          <aside aria-labelledby="output-order-heading" className="space-y-2 lg:sticky lg:top-4 lg:self-start">
            <h3 id="output-order-heading" className="text-sm font-medium">Output order</h3>
            <OutputOrderList items={outputItems} onPlace={placeColumn} onRemove={toggleColumn} />
          </aside>
        </div>
      </section>

      </details>

      <section className="space-y-3 border-t border-line pt-5">
        <h3 className="text-sm font-semibold">3. Generate</h3>
        <div className="space-y-3 border-b border-line pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={recommendFilters} disabled={isGenerating || isExecuting || isRecommending || isRecommendingFilters || selectedTables.length === 0 || question.trim().length < 3 || !selectedProvider?.available}
              className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"><Sparkles size={14} />{isRecommendingFilters ? 'Finding filters...' : 'Recommend filters'}</button>
            <label className="min-w-0 flex-1 text-sm"><span className="sr-only">Add filter column</span>
              <select value="" disabled={isGenerating || isExecuting || isRecommendingFilters || selectedTables.length === 0 || filters.length >= 20} className="w-full min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-sm disabled:opacity-50" onChange={(event) => {
                const columnId = event.target.value
                const table = selectedTables.find((candidate) => candidate.columns.some((column) => column.id === columnId))
                const column = table?.columns.find((candidate) => candidate.id === columnId)
                if (!table || !column) return
                const filter = defineQueryFilter({ id: `filter_${crypto.randomUUID()}`, table: table.name, column: column.name, operator: 'eq', defaultValue: filterInputType(column.column_data_type) === 'boolean' ? true : '' }, column, table.display_name, false)
                resetResults(); setFilters((current) => [...current, filter]); setFiltersReviewed(true)
              }}>
                <option value="">Add filter...</option>
                {selectedTables.map((table) => <optgroup key={table.id} label={table.display_name}>{table.columns.filter((column) => filterInputType(column.column_data_type, column.allowed_values)).map((column) => <option key={column.id} value={column.id}>{column.display_name}</option>)}</optgroup>)}
              </select>
            </label>
          </div>
          {!filtersReviewed && <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted"><span>Filter review pending</span><button type="button" disabled={isGenerating || isRecommendingFilters} onClick={() => { resetResults(); setFilters([]); setFiltersReviewed(true) }} className="text-accent underline">Use no filters</button></div>}
          {filterError && <p role="alert" className="text-sm text-red-600">{filterError}</p>}
          <FilterParameters filters={filters} disabled={isGenerating || isExecuting || isRecommendingFilters}
            onFiltersChange={(next) => { resetResults(); setFilters(next); setFiltersReviewed(true) }}
            onValuesChange={(values) => {
              setFilters((current) => current.map((filter) => Object.hasOwn(values, filter.id) ? { ...filter, defaultValue: values[filter.id]! } : filter))
              setExecution(null); setSaveMessage(''); setHasUnsavedChanges(true)
            }} />
        </div>
        {hasTableWithoutColumns && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Choose at least one column from every selected table.
          </p>
        )}
        {generationError && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{generationError}</p>}
        <details className="space-y-3"><summary className="cursor-pointer text-sm text-ink-muted">AI Settings</summary>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="llm-provider" className="block text-xs font-medium text-ink-muted">
              LLM provider
            </label>
            <select
              id="llm-provider"
              value={provider ?? ''}
              disabled={providerOptions.length === 0}
              onChange={(event) => {
                setChosenProvider(event.target.value as LlmProvider)
                setChosenModel(null)
              }}
              className="min-w-56 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
            >
              {providerOptions.length === 0 && (
                <option value="">{providersQuery.isPending ? 'Loading providers…' : 'No providers configured'}</option>
              )}
              {providerOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.available}>
                  {option.label}
                  {option.id === providersQuery.data?.defaultProvider ? ' (default)' : ''}
                  {option.available ? '' : ' — not running'}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 space-y-1">
            <label htmlFor="llm-model" className="block text-xs font-medium text-ink-muted">
              Model
            </label>
            <select
              id="llm-model"
              value={model ?? ''}
              disabled={!selectedProvider || selectedProvider.models.length < 2}
              onChange={(event) => setChosenModel(event.target.value)}
              title={model}
              className="w-64 max-w-full truncate rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent disabled:opacity-60"
            >
              {selectedProvider?.models.map((option) => (
                <option key={option} value={option}>
                  {option}
                  {option === selectedProvider.model ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        </details>
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={generateQuery}
            disabled={
              isGenerating ||
              isRecommending ||
              isRecommendingFilters ||
              invalidFilters ||
              !filtersReviewed ||
              !selectedProvider?.available ||
              question.trim().length < 3 ||
              selectedTables.length === 0 ||
              hasTableWithoutColumns
            }
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? 'Generating…' : 'Generate SQL'}
          </button>
        </div>
      </section>

      {generatedQuery && (
        <section className="space-y-4 border-t border-line pt-5" aria-labelledby="query-draft-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="query-draft-heading" className="text-sm font-semibold">SQL draft</h2>
            <span className="text-xs text-ink-muted">
              {generatedQuery.provider} · {generatedQuery.model}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-ink-muted">{generatedQuery.explanation}</p>
          <pre className="max-h-80 overflow-auto rounded-lg border border-line bg-surface-muted p-4 text-xs leading-relaxed whitespace-pre-wrap">
            <code>{generatedQuery.sql}</code>
          </pre>
          <div className="flex flex-wrap items-center gap-3">
            {saveMessage ? <p role="status" className="flex items-center gap-2 text-sm text-accent"><Check size={16} />{saveName} · Saved</p> : (
              <button type="button" disabled={isSaving || invalidFilters} onClick={() => setSaveDialog('save')} className="flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm"><Save size={16} />{editingQuery ? 'Save changes' : 'Save query'}</button>
            )}
            {editingQuery && <button type="button" disabled={isSaving || invalidFilters} onClick={() => setSaveDialog('copy')} className="flex items-center gap-2 text-sm text-ink-muted"><Copy size={16} />Save a copy</button>}
          </div>
          {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
          {executionError && <p role="alert" className="text-sm text-red-600 dark:text-red-300">{executionError}</p>}
          <button
            type="button"
            onClick={executeQuery}
            disabled={isExecuting || invalidFilters}
            className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center gap-2"><Play size={16} />{isExecuting ? 'Running query…' : 'Run query'}</span>
          </button>
        </section>
      )}

      {execution && (
        <section className="space-y-4 border-t border-line pt-5" aria-labelledby="query-results-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="query-results-heading" className="text-sm font-semibold">Results</h2>
            <span className="text-xs tabular-nums text-ink-muted">
              {execution.result.rowCount} rows · {execution.model}
            </span>
          </div>
          <QueryResultsTable
            key={execution.queryToken}
            result={execution.result}
            preferredColumnOrder={orderedOutput.map(({ table, column }) =>
              orderedOutput.filter((entry) => entry.column.name === column.name).length > 1
                ? `${table.name}_${column.name}`
                : column.name,
            )}
          />
        </section>
      )}
      {saveDialog && <QueryNameDialog title={saveDialog === 'copy' ? 'Save a copy' : editingQuery ? 'Save changes' : 'Save query'}
        initialName={saveDialog === 'copy' ? `${saveName.slice(0, 113)} (copy)` : saveName}
        submitLabel={saveDialog === 'copy' ? 'Save copy' : editingQuery ? 'Save changes' : 'Save'}
        onClose={() => setSaveDialog(null)} onSubmit={saveQuery} />}
    </div>
  )
}