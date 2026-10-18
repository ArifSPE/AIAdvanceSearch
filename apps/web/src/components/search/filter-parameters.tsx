'use client'

import { filterOperators, validateFilterValue, type FilterValue, type FilterValues, type QueryFilter } from '@ais/shared'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useId } from 'react'

export const filterOperatorLabels: Record<QueryFilter['operator'], string> = {
  eq: 'Equals', ne: 'Does not equal', gt: 'Greater than', gte: 'At least', lt: 'Less than', lte: 'At most', contains: 'Contains', startsWith: 'Starts with', isNull: 'Is empty', isNotNull: 'Is not empty',
}

function dateTimeInput(value: FilterValue) {
  if (!value) return ''
  const date = new Date(String(value))
  if (!Number.isFinite(date.getTime())) return ''
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function FilterParameters({ filters, values, onValuesChange, onFiltersChange, disabled = false, title = 'Filter parameters' }: {
  filters: QueryFilter[]
  values?: FilterValues
  onValuesChange: (values: FilterValues) => void
  onFiltersChange?: (filters: QueryFilter[]) => void
  disabled?: boolean
  title?: string
}) {
  const prefix = useId()
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-medium">{title}{filters.length > 0 ? ` (${filters.length})` : ''}</h4>
        {!onFiltersChange && filters.length > 0 && <button type="button" disabled={disabled} onClick={() => onValuesChange({})} className="flex items-center gap-1 text-xs text-ink-muted"><RotateCcw size={14} />Reset defaults</button>}
      </div>
      {filters.length === 0 && <p className="text-xs text-ink-muted">No filters.</p>}
      <div className="divide-y divide-line">
        {filters.map((filter) => {
          const value = values && Object.hasOwn(values, filter.id) ? values[filter.id]! : filter.defaultValue
          const error = validateFilterValue(filter, value)
          const id = `${prefix}-${filter.id}`
          const noValue = filter.operator === 'isNull' || filter.operator === 'isNotNull'
          const setValue = (next: FilterValue) => onValuesChange({ ...values, [filter.id]: next })
          return (
            <div key={filter.id} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-3">
                <label htmlFor={id} className="min-w-0 break-words text-sm font-medium">{filter.label}</label>
                {onFiltersChange && <button type="button" disabled={disabled} aria-label={`Remove ${filter.label} filter`} title="Remove filter" onClick={() => onFiltersChange(filters.filter((candidate) => candidate.id !== filter.id))} className="shrink-0 rounded p-1 text-ink-muted hover:text-red-600"><Trash2 size={16} /></button>}
              </div>
              <p id={`${id}-description`} className="break-words text-xs text-ink-muted">{filter.description || `${filter.table}.${filter.column}`} · {filter.dataType}</p>
              <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
                {onFiltersChange ? <select aria-label={`Operator for ${filter.label}`} disabled={disabled} value={filter.operator} onChange={(event) => onFiltersChange(filters.map((candidate) => candidate.id === filter.id ? { ...candidate, operator: event.target.value as QueryFilter['operator'] } : candidate))} className="min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-sm">
                  {filterOperators(filter.inputType).map((operator) => <option key={operator} value={operator}>{filterOperatorLabels[operator]}</option>)}
                </select> : <span className="self-center text-sm text-ink-muted">{filterOperatorLabels[filter.operator]}</span>}
                {noValue ? <span id={id} className="self-center text-sm text-ink-muted">No value required</span> : filter.inputType === 'boolean' ? (
                  <select id={id} disabled={disabled} value={value === '' || value === null ? '' : String(value)} onChange={(event) => setValue(event.target.value === '' ? '' : event.target.value === 'true')} aria-describedby={`${id}-description`} aria-invalid={Boolean(error)} className="min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-sm">
                    <option value="">Select a value</option><option value="true">Yes</option><option value="false">No</option>
                  </select>
                ) : filter.inputType === 'enum' ? (
                  <select id={id} disabled={disabled} value={String(value ?? '')} onChange={(event) => setValue(event.target.value)} aria-describedby={`${id}-description`} aria-invalid={Boolean(error)} className="min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-sm">
                    <option value="">Select a value</option>{filter.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                  </select>
                ) : (
                  <input id={id} disabled={disabled} type={filter.inputType === 'integer' || filter.inputType === 'number' ? 'number' : filter.inputType === 'datetime' ? 'datetime-local' : filter.inputType === 'date' ? 'date' : 'text'}
                    step={filter.inputType === 'integer' ? '1' : filter.inputType === 'number' ? 'any' : undefined}
                    maxLength={filter.maxLength > 0 ? filter.maxLength : 4000}
                    value={filter.inputType === 'datetime' ? dateTimeInput(value) : String(value ?? '')}
                    onChange={(event) => {
                      const next = event.target.value
                      if (filter.inputType !== 'datetime' || next === '') { setValue(next); return }
                      const date = new Date(next)
                      setValue(Number.isFinite(date.getTime()) ? date.toISOString() : '')
                    }} aria-describedby={`${id}-description${error ? ` ${id}-error` : ''}`} aria-invalid={Boolean(error)}
                    className="min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent" />
                )}
              </div>
              {error && <p id={`${id}-error`} role="alert" className="text-xs text-red-600">{error}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}