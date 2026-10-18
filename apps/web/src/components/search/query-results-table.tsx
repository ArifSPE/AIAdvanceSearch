'use client'

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import type { QueryExecutionResult } from '@ais/shared'

type ResultRow = Record<string, unknown>

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function QueryResultsTable({
  result,
  preferredColumnOrder,
}: {
  result: QueryExecutionResult
  /** Column names in the order the user asked for; unmatched result columns follow. */
  preferredColumnOrder?: string[]
}) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(() => {
    if (!preferredColumnOrder?.length) return []
    const names = result.columns.map((column) => column.name)
    const preferred = [...new Set(preferredColumnOrder)].filter((name) => names.includes(name))
    return [...preferred, ...names.filter((name) => !preferred.includes(name))]
  })
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)

  const columns: ColumnDef<ResultRow>[] = result.columns.map((column) => ({
    id: column.name,
    accessorFn: (row) => row[column.name],
    header: column.name,
    size: 180,
    minSize: 96,
    maxSize: 560,
    sortingFn: (leftRow, rightRow, columnId) => {
      const left = leftRow.getValue(columnId)
      const right = rightRow.getValue(columnId)
      if (column.type === 'numeric' || column.type === 'integer' || column.type === 'bigint') {
        return Number(left) - Number(right)
      }
      return formatCell(left).localeCompare(formatCell(right), undefined, { numeric: true })
    },
    cell: (context) => (
      <span className="block max-w-full truncate" title={formatCell(context.getValue())}>
        {formatCell(context.getValue())}
      </span>
    ),
  }))

  const table = useReactTable({
    data: result.rows as ResultRow[],
    columns,
    state: { globalFilter, sorting, columnOrder },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  function moveColumn(targetId: string) {
    if (!draggedColumn || draggedColumn === targetId) return
    const currentOrder = columnOrder.length
      ? [...columnOrder]
      : table.getAllLeafColumns().map((column) => column.id)
    const sourceIndex = currentOrder.indexOf(draggedColumn)
    const targetIndex = currentOrder.indexOf(targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    currentOrder.splice(sourceIndex, 1)
    currentOrder.splice(targetIndex, 0, draggedColumn)
    setColumnOrder(currentOrder)
    setDraggedColumn(null)
  }

  const visibleRows = table.getRowModel().rows

  return (
    <section className="space-y-3" aria-label="Query results">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium tabular-nums">
          {visibleRows.length} row{visibleRows.length === 1 ? '' : 's'}
          {globalFilter ? ' matching filter' : ''}
          {result.truncated && <span className="ml-2 text-amber-700 dark:text-amber-300">First 200 rows shown</span>}
        </p>
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span>Filter results</span>
          <input
            type="search"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search rows…"
            className="w-56 rounded-md border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-accent"
          />
        </label>
      </div>

      <div className="overflow-auto rounded-lg border border-line">
        <table className="w-full border-separate border-spacing-0 text-left text-sm" style={{ width: table.getTotalSize() }}>
          <thead className="sticky top-0 z-10 bg-surface-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortState = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedColumn(header.column.id)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', header.column.id)
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        moveColumn(header.column.id)
                      }}
                      onDragEnd={() => setDraggedColumn(null)}
                      className="relative border-b border-line px-3 py-2.5 font-semibold"
                      style={{ width: header.getSize() }}
                      title="Drag to reorder this column"
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="flex w-full items-center justify-between gap-3 text-left"
                        >
                          <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          <span aria-hidden="true" className="shrink-0 text-xs text-ink-muted">
                            {sortState === 'asc' ? '↑' : sortState === 'desc' ? '↓' : '↕'}
                          </span>
                        </button>
                      )}
                      {header.column.getCanResize() && (
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${header.column.id} column`}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-accent"
                        />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(result.columns.length, 1)} className="px-3 py-8 text-center text-ink-muted">
                  {globalFilter ? 'No rows match this filter.' : 'The query returned no rows.'}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id} className="odd:bg-surface even:bg-surface-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="max-w-0 border-b border-line px-3 py-2 align-top last:border-b-0"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-muted">Click a heading to sort. Drag headings to reorder; drag the right edge to resize.</p>
    </section>
  )
}