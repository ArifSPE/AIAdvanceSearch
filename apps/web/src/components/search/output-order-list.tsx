'use client'

import { Fragment, useRef, useState, type DragEvent } from 'react'

/** Drag payload type shared with the entity diagram. */
export const COLUMN_DRAG_TYPE = 'application/x-ais-column'

export interface OutputItem {
  id: string
  label: string
  detail: string
}

interface OutputOrderListProps {
  items: OutputItem[]
  /** Place a column (new or already listed) at `index` in the output order. */
  onPlace: (columnId: string, index: number) => void
  onRemove: (columnId: string) => void
}

export function OutputOrderList({ items, onPlace, onRemove }: OutputOrderListProps) {
  const itemRefs = useRef(new Map<string, HTMLLIElement>())
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  function indexFromPointer(clientY: number): number {
    for (const [index, item] of items.entries()) {
      const rect = itemRefs.current.get(item.id)?.getBoundingClientRect()
      if (rect && clientY < rect.top + rect.height / 2) return index
    }
    return items.length
  }

  function handleDragOver(event: DragEvent) {
    if (!event.dataTransfer.types.includes(COLUMN_DRAG_TYPE)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropIndex(indexFromPointer(event.clientY))
  }

  function handleDrop(event: DragEvent) {
    const columnId = event.dataTransfer.getData(COLUMN_DRAG_TYPE)
    if (!columnId) return
    event.preventDefault()
    onPlace(columnId, indexFromPointer(event.clientY))
    setDropIndex(null)
  }

  const indicator = <li aria-hidden="true" className="h-0.5 rounded-full bg-accent" />

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropIndex(null)
      }}
      onDrop={handleDrop}
      className={`rounded-lg border border-dashed p-3 transition-colors ${
        dropIndex === null ? 'border-line' : 'border-accent bg-accent/5'
      }`}
    >
      {items.length === 0 && dropIndex === null ? (
        <p className="px-1 py-6 text-center text-sm text-ink-muted">
          Drag columns here from the diagram, or click a column to add it.
        </p>
      ) : (
        <ol aria-label="Output column order" className="space-y-1.5">
          {items.map((item, index) => (
            <Fragment key={item.id}>
              {dropIndex === index && indicator}
              <li
                ref={(element) => {
                  if (element) itemRefs.current.set(item.id, element)
                  else itemRefs.current.delete(item.id)
                }}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData(COLUMN_DRAG_TYPE, item.id)
                }}
                onDragEnd={() => setDropIndex(null)}
                className="flex cursor-grab items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-2 text-sm active:cursor-grabbing"
              >
                <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-accent">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.label}</span>
                  <span className="block truncate text-xs text-ink-muted">{item.detail}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Move ${item.label} up`}
                  disabled={index === 0}
                  onClick={() => onPlace(item.id, index - 1)}
                  className="rounded px-1.5 py-1 text-xs text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${item.label} down`}
                  disabled={index === items.length - 1}
                  onClick={() => onPlace(item.id, index + 2)}
                  className="rounded px-1.5 py-1 text-xs text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => onRemove(item.id)}
                  className="rounded px-1.5 py-1 text-xs text-ink-muted hover:bg-surface-muted hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            </Fragment>
          ))}
          {dropIndex === items.length && indicator}
        </ol>
      )}
    </div>
  )
}
