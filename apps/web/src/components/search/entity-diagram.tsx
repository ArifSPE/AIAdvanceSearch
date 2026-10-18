'use client'

import type { MetadataTableWithColumns } from '@ais/shared'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { COLUMN_DRAG_TYPE } from './output-order-list'

const shortTypeNames: Record<string, string> = {
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  'character varying': 'varchar',
  'double precision': 'float8',
}

function shortType(type: string): string {
  return shortTypeNames[type] ?? type
}

interface EntityDiagramProps {
  tables: MetadataTableWithColumns[]
  /** Selected column ids, in output order. */
  outputColumnIds: string[]
  onToggleColumn: (columnId: string) => void
}

interface Link {
  columnId: string
  childTableId: string
  parentTableId: string
  parentAnchorId: string | undefined
}

interface Line {
  id: string
  d: string
  x1: number
  y1: number
  o1: 1 | -1
  x2: number
  y2: number
  o2: 1 | -1
}

/** Parents before children, so relationship lines tend to flow left to right. */
function orderParentsFirst(tables: MetadataTableWithColumns[]): MetadataTableWithColumns[] {
  const byName = new Map(tables.map((table) => [table.name, table]))
  const depths = new Map<string, number>()

  function depthOf(table: MetadataTableWithColumns, path: Set<string>): number {
    const known = depths.get(table.id)
    if (known !== undefined) return known
    if (path.has(table.id)) return 0

    const nextPath = new Set(path).add(table.id)
    const parentDepths: number[] = []
    for (const column of table.columns) {
      const parent = column.is_foreign_key && column.parent_table ? byName.get(column.parent_table) : undefined
      if (parent && parent.id !== table.id) parentDepths.push(depthOf(parent, nextPath))
    }
    const depth = parentDepths.length ? 1 + Math.max(...parentDepths) : 0
    depths.set(table.id, depth)
    return depth
  }

  return [...tables].sort((a, b) => depthOf(a, new Set()) - depthOf(b, new Set()))
}

function findLinks(tables: MetadataTableWithColumns[]): Link[] {
  const byName = new Map(tables.map((table) => [table.name, table]))
  return tables.flatMap((table) =>
    table.columns.flatMap((column): Link[] => {
      const parent = column.is_foreign_key && column.parent_table ? byName.get(column.parent_table) : undefined
      if (!parent || parent.id === table.id) return []

      const primaryKeys = parent.columns.filter((candidate) => candidate.is_primary_key)
      const anchor = primaryKeys.find((candidate) => candidate.name === column.name) ?? primaryKeys[0]
      return [{ columnId: column.id, childTableId: table.id, parentTableId: parent.id, parentAnchorId: anchor?.id }]
    }),
  )
}

export function EntityDiagram({ tables, outputColumnIds, onToggleColumn }: EntityDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardEls = useRef(new Map<string, HTMLElement>())
  const rowEls = useRef(new Map<string, HTMLElement>())
  const [lines, setLines] = useState<Line[]>([])

  const ordered = useMemo(() => orderParentsFirst(tables), [tables])
  const links = useMemo(() => findLinks(tables), [tables])
  const childTableIds = useMemo(() => new Set(links.map((link) => link.childTableId)), [links])
  const parentTableIds = useMemo(() => new Set(links.map((link) => link.parentTableId)), [links])

  const measure = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const origin = container.getBoundingClientRect()
    const next: Line[] = []

    for (const link of links) {
      const row = rowEls.current.get(link.columnId)
      const childCard = cardEls.current.get(link.childTableId)
      const parentCard = cardEls.current.get(link.parentTableId)
      if (!row || !childCard || !parentCard) continue

      const anchor = (link.parentAnchorId && rowEls.current.get(link.parentAnchorId)) || parentCard
      const rowRect = row.getBoundingClientRect()
      const child = childCard.getBoundingClientRect()
      const parent = parentCard.getBoundingClientRect()
      const anchorRect = anchor.getBoundingClientRect()

      let x1: number
      let x2: number
      let o1: 1 | -1
      let o2: 1 | -1
      if (child.right + 16 <= parent.left) {
        ;[x1, x2, o1, o2] = [child.right, parent.left, 1, -1]
      } else if (parent.right + 16 <= child.left) {
        ;[x1, x2, o1, o2] = [child.left, parent.right, -1, 1]
      } else {
        // Stacked in the same column: loop out around the right-hand side.
        ;[x1, x2, o1, o2] = [child.right, parent.right, 1, 1]
      }

      x1 = Math.round(x1 - origin.left)
      x2 = Math.round(x2 - origin.left)
      const y1 = Math.round(rowRect.top + rowRect.height / 2 - origin.top)
      const y2 = Math.round(anchorRect.top + anchorRect.height / 2 - origin.top)
      const reach = o1 === o2 ? 40 : Math.max(32, Math.abs(x2 - x1) / 2)

      next.push({
        id: link.columnId,
        d: `M ${x1} ${y1} C ${x1 + o1 * reach} ${y1}, ${x2 + o2 * reach} ${y2}, ${x2} ${y2}`,
        x1, y1, o1, x2, y2, o2,
      })
    }

    setLines((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
  }, [links])

  useLayoutEffect(() => {
    measure()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [measure, ordered])

  if (tables.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line py-12 text-center text-sm text-ink-muted">
        Select one or more tables to see how they relate.
      </p>
    )
  }

  return (
    <div className="@container space-y-2">
      <div ref={containerRef} className="relative grid gap-x-16 gap-y-8 @md:grid-cols-2 @3xl:grid-cols-3">
        {ordered.map((table) => {
          const isParent = parentTableIds.has(table.id)
          const isChild = childTableIds.has(table.id)

          return (
            <section
              key={table.id}
              ref={(element) => {
                if (element) cardEls.current.set(table.id, element)
                else cardEls.current.delete(table.id)
              }}
              aria-label={`${table.display_name} table`}
              className="min-w-0 rounded-lg border border-line bg-surface shadow-sm"
            >
              <header className="flex items-start justify-between gap-2 rounded-t-lg border-b border-line bg-surface-muted px-3 py-2.5">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{table.display_name}</h3>
                  <p className="truncate text-[11px] text-ink-muted">{table.name}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {isParent && (
                    <span className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
                      Parent
                    </span>
                  )}
                  {isChild && (
                    <span className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-ink-muted uppercase">
                      Child
                    </span>
                  )}
                </div>
              </header>

              <ul className="py-1">
                {table.columns.map((column) => {
                  const position = outputColumnIds.indexOf(column.id)
                  const isSelected = position >= 0

                  return (
                    <li key={column.id}>
                      <div
                        ref={(element) => {
                          if (element) rowEls.current.set(column.id, element)
                          else rowEls.current.delete(column.id)
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        aria-label={`${column.display_name}, ${isSelected ? `output position ${position + 1}` : 'not in output'}`}
                        title={`${table.name}.${column.name} \u00b7 ${column.column_data_type}${column.is_foreign_key ? ` \u00b7 references ${column.parent_table}` : ''}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'copyMove'
                          event.dataTransfer.setData(COLUMN_DRAG_TYPE, column.id)
                        }}
                        onClick={() => onToggleColumn(column.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            onToggleColumn(column.id)
                          }
                        }}
                        className={`flex cursor-grab items-center gap-2 px-3 py-1.5 text-sm outline-none select-none focus-visible:bg-surface-muted active:cursor-grabbing ${
                          isSelected ? 'bg-accent/10' : 'hover:bg-surface-muted'
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`w-4 shrink-0 text-center text-xs tabular-nums ${
                            isSelected ? 'font-semibold text-accent' : 'text-ink-muted'
                          }`}
                        >
                          {isSelected ? position + 1 : '\u22ee'}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{column.display_name}</span>
                        {column.is_primary_key && <span className="text-[10px] font-semibold text-accent">PK</span>}
                        {column.is_foreign_key && <span className="text-[10px] font-semibold text-ink-muted">FK</span>}
                        <span className="shrink-0 text-[11px] text-ink-muted">{shortType(column.column_data_type)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}

        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          {lines.map((line) => (
            <g key={line.id}>
              <path d={line.d} className="fill-none stroke-accent" strokeWidth={1.5} />
              <circle cx={line.x1} cy={line.y1} r={3} className="fill-accent" />
              <circle cx={line.x2} cy={line.y2} r={3} className="fill-accent" />
              <text x={line.x1 + line.o1 * 12} y={line.y1 - 5} textAnchor="middle" className="fill-ink-muted text-[10px]">N</text>
              <text x={line.x2 + line.o2 * 12} y={line.y2 - 5} textAnchor="middle" className="fill-ink-muted text-[10px]">1</text>
            </g>
          ))}
        </svg>
      </div>

      {links.length > 0 && (
        <p className="text-xs text-ink-muted">
          Lines join a foreign key (<span className="font-medium">N</span>) to the primary key it references (
          <span className="font-medium">1</span>).
        </p>
      )}
    </div>
  )
}
