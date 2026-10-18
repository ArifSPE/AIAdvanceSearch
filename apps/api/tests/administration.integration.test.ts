import { createAppDatabase, curatedPrompts, eq, llmProviderSettings, users } from '@ais/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAccessToken } from '../src/modules/auth/tokens'
import { resolveLlmModel } from '../src/modules/llm/query-generation.service'

describe.skipIf(process.env.RUN_DB_INTEGRATION_TESTS !== 'true')('Administration API integration', () => {
  let app: Awaited<ReturnType<(typeof import('../src/server'))['buildServer']>>
  let connection: ReturnType<typeof createAppDatabase>
  let previousProvider: typeof llmProviderSettings.$inferSelect | undefined
  const userId = crypto.randomUUID()
  let authorization: string
  let promptId: string | undefined
  const promptName = `Admin integration ${crypto.randomUUID()}`
  const providerInput = {
    provider: 'ollama', label: 'Local integration provider', model: 'integration-model', fallbackModel: null,
    models: ['integration-alternate'], enabled: true, isDefault: false, awsRegion: null, awsProfile: null,
  }

  beforeAll(async () => {
    const { buildServer } = await import('../src/server')
    app = await buildServer()
    connection = createAppDatabase({ max: 1 })
    ;[previousProvider] = await connection.db.select().from(llmProviderSettings).where(eq(llmProviderSettings.provider, 'ollama'))
    await connection.db.insert(users).values({ id: userId, email: `admin-${userId}@example.test` })
    authorization = `Bearer ${await createAccessToken({ id: userId, email: `admin-${userId}@example.test` })}`
  })

  afterAll(async () => {
    try {
      if (promptId) await connection.db.delete(curatedPrompts).where(eq(curatedPrompts.id, promptId))
      await connection.db.delete(llmProviderSettings).where(eq(llmProviderSettings.provider, 'ollama'))
      if (previousProvider) await connection.db.insert(llmProviderSettings).values(previousProvider)
      await connection.db.delete(users).where(eq(users.id, userId))
    } finally { await Promise.all([app?.close(), connection?.close()]) }
  })

  it('requires sign-in on every admin endpoint', async () => {
    for (const [method, url, payload] of [
      ['GET', '/api/v1/admin/providers', undefined], ['GET', '/api/v1/admin/prompts', undefined],
      ['PUT', '/api/v1/admin/providers', providerInput],
      ['PUT', '/api/v1/admin/prompts', { label: promptName, category: 'Tests', question: 'List loans', enabled: true, sortOrder: 1 }],
      ['DELETE', `/api/v1/admin/prompts/${crypto.randomUUID()}`, undefined],
    ] as const) {
      const response = await app.inject({ method, url, payload })
      expect(response.statusCode).toBe(401)
    }
  })

  it('blocks ordinary users from reading or changing administration settings', async () => {
    for (const [method, url, payload] of [
      ['GET', '/api/v1/admin/providers', undefined], ['GET', '/api/v1/admin/prompts', undefined],
      ['PUT', '/api/v1/admin/providers', providerInput],
      ['PUT', '/api/v1/admin/prompts', { label: promptName, category: 'Tests', question: 'List loans', enabled: true, sortOrder: 1 }],
      ['DELETE', `/api/v1/admin/prompts/${crypto.randomUUID()}`, undefined],
    ] as const) {
      const response = await app.inject({ method, url, payload, headers: { authorization } })
      expect(response.statusCode).toBe(403)
    }
  })

  it('honors SQL role assignment immediately, without replacing the access token', async () => {
    await connection.db.update(users).set({ role: 'IT-Admin' }).where(eq(users.id, userId))
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/providers', headers: { authorization } })
    expect(response.statusCode).toBe(200)
    expect(response.json().items).toHaveLength(4)
    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization } })
    expect(me.json().role).toBe('IT-Admin')
  })

  it('publishes, edits, hides, and deletes curated prompts', async () => {
    const input = { label: promptName, category: 'Integration tests', question: 'List active loans.', enabled: true, sortOrder: 123 }
    const created = await app.inject({ method: 'PUT', url: '/api/v1/admin/prompts', headers: { authorization }, payload: input })
    expect(created.statusCode).toBe(200)
    promptId = created.json().id
    const published = await app.inject({ method: 'GET', url: '/api/v1/prompts', headers: { authorization } })
    expect(published.json().items.some((prompt: { id: string }) => prompt.id === promptId)).toBe(true)
    const edited = await app.inject({ method: 'PUT', url: '/api/v1/admin/prompts', headers: { authorization }, payload: { ...input, id: promptId, enabled: false, question: 'List loans with missed payments.' } })
    expect(edited.statusCode).toBe(200)
    expect(edited.json().question).toBe('List loans with missed payments.')
    const hidden = await app.inject({ method: 'GET', url: '/api/v1/prompts', headers: { authorization } })
    expect(hidden.json().items.some((prompt: { id: string }) => prompt.id === promptId)).toBe(false)
    const all = await app.inject({ method: 'GET', url: '/api/v1/admin/prompts', headers: { authorization } })
    expect(all.json().items.some((prompt: { id: string }) => prompt.id === promptId)).toBe(true)
    const deleted = await app.inject({ method: 'DELETE', url: `/api/v1/admin/prompts/${promptId}`, headers: { authorization } })
    expect(deleted.statusCode).toBe(204)
    const missing = await app.inject({ method: 'DELETE', url: `/api/v1/admin/prompts/${promptId}`, headers: { authorization } })
    expect(missing.statusCode).toBe(404)
  })

  it('uses provider overrides in the runtime allowlist and omits secrets in responses', async () => {
    const saved = await app.inject({ method: 'PUT', url: '/api/v1/admin/providers', headers: { authorization }, payload: providerInput })
    expect(saved.statusCode).toBe(200)
    expect(saved.json().models).toEqual(['integration-model', 'integration-alternate'])
    expect(saved.json()).not.toHaveProperty('apiKey')
    expect(saved.json()).not.toHaveProperty('accessKeyId')
    const resolved = await resolveLlmModel('ollama', 'integration-alternate', connection.db)
    expect(resolved.modelId).toBe('integration-alternate')
    await expect(resolveLlmModel('ollama', 'not-allowed', connection.db)).rejects.toThrow('Model is not allowed')
    const listed = await app.inject({ method: 'GET', url: '/api/v1/llm/providers', headers: { authorization } })
    const provider = listed.json().providers.find((entry: { id: string }) => entry.id === 'ollama')
    expect(provider.model).toBe('integration-model')
    expect(provider).not.toHaveProperty('apiKey')
    await app.inject({ method: 'PUT', url: '/api/v1/admin/providers', headers: { authorization }, payload: { ...providerInput, enabled: false } })
    await expect(resolveLlmModel('ollama', undefined, connection.db)).rejects.toThrow('not configured')
  })

  it('rejects a disabled default and unsafe profile names', async () => {
    for (const input of [{ ...providerInput, enabled: false, isDefault: true }, { ...providerInput, awsProfile: '../credentials' }]) {
      const response = await app.inject({ method: 'PUT', url: '/api/v1/admin/providers', headers: { authorization }, payload: input })
      expect(response.statusCode).toBe(400)
    }
  })

  it('revokes admin access immediately after SQL demotion', async () => {
    await connection.db.update(users).set({ role: 'User' }).where(eq(users.id, userId))
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/providers', headers: { authorization } })
    expect(response.statusCode).toBe(403)
  })
})