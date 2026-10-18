'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

export function QueryNameDialog({ title, initialName, submitLabel, onSubmit, onClose, destructive = false }: {
  title: string
  initialName: string
  submitLabel: string
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
  destructive?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initialName)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    nameInput.current?.focus()
    nameInput.current?.select()
    return () => element?.close()
  }, [])
  return (
    <dialog ref={dialog} aria-labelledby="query-name-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-5 text-ink shadow-xl backdrop:bg-black/40">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="query-name-title" className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} disabled={busy} aria-label="Close dialog" title="Close dialog" className="rounded p-2 hover:bg-surface-muted"><X size={18} /></button>
      </div>
      <form className="space-y-4" onSubmit={async (event) => {
        event.preventDefault()
        if (!name.trim() || busy) return
        setBusy(true)
        setError('')
        try { await onSubmit(name.trim()); onClose() }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save the query.'); setBusy(false) }
      }}>
        {destructive ? <p className="break-words text-sm">Delete “{initialName}” permanently?</p> : (
          <label className="block space-y-2 text-sm"><span>Query name</span>
            <input ref={nameInput} autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-md border border-line bg-surface px-3 py-2.5 outline-none focus:border-accent" />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-md border border-line px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className={`rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${destructive ? 'bg-red-600' : 'bg-accent'}`}>{busy ? 'Working...' : submitLabel}</button>
        </div>
      </form>
    </dialog>
  )
}