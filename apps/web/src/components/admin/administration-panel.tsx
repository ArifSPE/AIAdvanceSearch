'use client'

import type { CuratedPrompt, PromptInput, ProviderSettings, ProviderSettingsInput } from '@ais/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { client } from '@/lib/orpc'
import { useAuth } from '@/providers/auth-provider'

const fieldClass = 'w-full min-w-0 rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent'
const buttonClass = 'inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50'

function ProviderForm({ setting, onSaved }: { setting: ProviderSettings; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<ProviderSettingsInput>(setting)
  const [models, setModels] = useState(setting.models.join('\n'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const credentials = setting.provider === 'openai' ? 'OPENAI_API_KEY' : setting.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : setting.provider === 'bedrock' ? 'AWS credential chain / SSO' : 'Server-managed Ollama endpoint'
  return (
    <form className="space-y-5" onChange={() => setSaved(false)} onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError(''); setSaved(false)
      try {
        await client.admin.saveProvider({ ...draft, models: models.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean) })
        await onSaved(); setSaved(true)
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save provider settings.') }
      finally { setBusy(false) }
    }}>
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-semibold">{setting.label}</h2><span className="text-xs text-ink-muted">{setting.source === 'database' ? 'Saved override' : 'Environment defaults'}</span></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>Display name</span><input required maxLength={80} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className={fieldClass} /></label>
        <label className="space-y-1 text-sm"><span>Default model</span><input required maxLength={256} value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} className={fieldClass} /></label>
        <label className="space-y-1 text-sm"><span>Fallback model</span><input maxLength={256} value={draft.fallbackModel ?? ''} onChange={(event) => setDraft({ ...draft, fallbackModel: event.target.value.trim() || null })} className={fieldClass} /></label>
      </div>
      <label className="block space-y-1 text-sm"><span>Allowed models</span><textarea rows={4} value={models} onChange={(event) => setModels(event.target.value)} className={fieldClass} placeholder="One model per line" /></label>
      {setting.provider === 'bedrock' && <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span>AWS region</span><input required={draft.enabled} value={draft.awsRegion ?? ''} onChange={(event) => setDraft({ ...draft, awsRegion: event.target.value || null })} className={fieldClass} /></label>
        <label className="space-y-1 text-sm"><span>AWS profile</span><input value={draft.awsProfile ?? ''} onChange={(event) => setDraft({ ...draft, awsProfile: event.target.value || null })} className={fieldClass} /></label>
      </div>}
      <p className="break-words text-xs text-ink-muted">Credential source: {credentials}{!setting.credentialsConfigured && setting.provider !== 'ollama' ? ' (not configured)' : ''}</p>
      <div className="flex flex-wrap gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked, isDefault: event.target.checked && draft.isDefault })} />Enabled</label>
        <label className="flex items-center gap-2"><input type="checkbox" disabled={!draft.enabled} checked={draft.isDefault} onChange={(event) => setDraft({ ...draft, isDefault: event.target.checked })} />Default provider</label>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {saved && <p role="status" className="text-sm text-accent">Provider settings saved.</p>}
      <button type="submit" disabled={busy} className={buttonClass}><Save size={16} />{busy ? 'Saving...' : 'Save provider'}</button>
    </form>
  )
}

function PromptForm({ prompt, onSaved }: { prompt: CuratedPrompt | null; onSaved: (prompt: CuratedPrompt | null) => Promise<void> }) {
  const [draft, setDraft] = useState<PromptInput>(prompt ?? { label: '', category: '', question: '', enabled: true, sortOrder: 100 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <form className="space-y-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError('')
      try { const result = await client.admin.savePrompt(draft); await onSaved(result) }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save prompt.') }
      finally { setBusy(false) }
    }}>
      <h2 className="text-lg font-semibold">{prompt ? 'Edit prompt' : 'New prompt'}</h2>
      <label className="block space-y-1 text-sm"><span>Prompt name</span><input required maxLength={120} value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} className={fieldClass} /></label>
      <label className="block space-y-1 text-sm"><span>Category</span><input required maxLength={80} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className={fieldClass} /></label>
      <label className="block space-y-1 text-sm"><span>Question</span><textarea required minLength={3} maxLength={2000} rows={6} value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} className={fieldClass} /></label>
      <div className="flex flex-wrap items-center gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Published</label>
        <label className="flex items-center gap-2"><span>Display order</span><input type="number" required min={0} max={10000} step={1} value={draft.sortOrder} onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) })} className={`${fieldClass} w-24`} /></label>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className={buttonClass}><Save size={16} />{busy ? 'Saving...' : 'Save prompt'}</button>
        {prompt && <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-red-600"><Trash2 size={16} />Delete</button>}
      </div>
      {confirmDelete && <div className="flex flex-wrap items-center gap-3 text-sm"><span>Delete this prompt permanently?</span>
        <button type="button" disabled={busy} className="text-red-600 underline" onClick={async () => {
          if (!prompt) return
          setBusy(true); setError('')
          try { await client.admin.removePrompt({ id: prompt.id }); await onSaved(null) }
          catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete prompt.') }
          finally { setBusy(false) }
        }}>Delete permanently</button><button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="underline">Cancel</button>
      </div>}
    </form>
  )
}

export function AdministrationPanel() {
  const { status, user } = useAuth()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'providers' | 'prompts'>('providers')
  const [providerId, setProviderId] = useState('')
  const [promptId, setPromptId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const enabled = status === 'authenticated' && user?.role === 'IT-Admin'
  const providers = useQuery({ queryKey: ['admin', 'providers'], queryFn: () => client.admin.providers(), enabled })
  const prompts = useQuery({ queryKey: ['admin', 'prompts'], queryFn: () => client.admin.prompts(), enabled })
  const selectedProvider = providers.data?.items.find((setting) => setting.provider === providerId) ?? providers.data?.items[0]
  const selectedPrompt = prompts.data?.items.find((prompt) => prompt.id === promptId) ?? null

  if (status === 'loading') return <p className="text-sm text-ink-muted">Checking access...</p>
  if (status === 'anonymous') return <p className="text-sm"><Link href="/login" className="text-accent underline">Sign in</Link> to access administration.</p>
  if (!enabled) return <p role="alert" className="text-sm">IT-Admin access required.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3"><ShieldCheck size={24} className="text-accent" /><h1 className="text-2xl font-semibold">Administration</h1></div>
      <div role="tablist" aria-label="Administration" className="flex gap-5 border-b border-line">
        {(['providers', 'prompts'] as const).map((value) => <button key={value} id={`tab-${value}`} role="tab" type="button" aria-controls={`panel-${value}`} aria-selected={tab === value} onClick={() => { setTab(value); setMessage('') }} className={`border-b-2 py-3 text-sm font-medium ${tab === value ? 'border-accent text-accent' : 'border-transparent text-ink-muted'}`}>{value === 'providers' ? 'LLM Providers' : 'Prompt Library'}</button>)}
      </div>
      {message && <p role="status" className="text-sm text-accent">{message}</p>}
      {(providers.error || prompts.error) && <p role="alert" className="text-sm text-red-600">{providers.error?.message ?? prompts.error?.message}</p>}
      {tab === 'providers' ? (
        <section role="tabpanel" id="panel-providers" aria-labelledby="tab-providers" className="space-y-5">
          {providers.isPending && <p className="text-sm text-ink-muted">Loading providers...</p>}
          <label className="block space-y-1 text-sm"><span>Provider</span><select value={selectedProvider?.provider ?? ''} onChange={(event) => setProviderId(event.target.value)} className={fieldClass}>
            {providers.data?.items.map((setting) => <option key={setting.provider} value={setting.provider}>{setting.label}{setting.enabled ? '' : ' (disabled)'}</option>)}
          </select></label>
          {selectedProvider && <ProviderForm key={selectedProvider.provider} setting={selectedProvider} onSaved={async () => { await queryClient.invalidateQueries({ queryKey: ['llm', 'providers'] }); await providers.refetch() }} />}
        </section>
      ) : (
        <section role="tabpanel" id="panel-prompts" aria-labelledby="tab-prompts" className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 space-y-1 text-sm"><span>Curated prompt</span><select value={promptId ?? ''} onChange={(event) => { setPromptId(event.target.value || null); setMessage('') }} className={fieldClass}>
              <option value="">New prompt</option>{prompts.data?.items.map((prompt) => <option key={prompt.id} value={prompt.id}>{prompt.category}: {prompt.label}{prompt.enabled ? '' : ' (draft)'}</option>)}
            </select></label>
            <button type="button" onClick={() => { setPromptId(null); setMessage('') }} className="flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm"><Plus size={16} />New</button>
          </div>
          <PromptForm key={`${promptId ?? 'new'}-${prompts.dataUpdatedAt}`} prompt={selectedPrompt} onSaved={async (prompt) => {
            await prompts.refetch(); await queryClient.invalidateQueries({ queryKey: ['prompts'] }); setPromptId(prompt?.id ?? null); setMessage(prompt ? 'Prompt saved.' : 'Prompt deleted.')
          }} />
        </section>
      )}
    </div>
  )
}