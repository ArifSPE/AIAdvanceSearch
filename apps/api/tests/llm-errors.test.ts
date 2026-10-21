import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createAccessToken } from '../src/modules/auth/tokens'
import { InvalidGeneratedPlanError } from '../src/modules/llm/llm-failure'

const mock = vi.hoisted(() => ({ generate: vi.fn(), recommend: vi.fn() }))
vi.mock('../src/modules/llm/query-generation.service', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/modules/llm/query-generation.service')>(),
  QueryGenerationService: class { generate = mock.generate },
}))
vi.mock('../src/modules/llm/selection-recommendation.service', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/modules/llm/selection-recommendation.service')>(),
  SelectionRecommendationService: class { recommend = mock.recommend },
}))

describe('user-facing LLM API errors', () => {
  let app: Awaited<ReturnType<(typeof import('../src/server'))['buildServer']>>
  let authorization: string
  beforeAll(async () => {
    const { buildServer } = await import('../src/server')
    app = await buildServer()
    authorization = `Bearer ${await createAccessToken({ id: crypto.randomUUID(), email: 'llm-error-test@example.test' })}`
  })
  afterAll(async () => { await app?.close() })

  it.each([
    [new AggregateError([new Error('AWS credential provider failed: Token is expired. PRIVATE_DETAIL')]), 503, 'LLM_CREDENTIALS_EXPIRED', 'refresh'],
    [new AggregateError([{ statusCode: 403, message: 'Forbidden PRIVATE_DETAIL' }]), 503, 'LLM_ACCESS_DENIED', 'permissions'],
    [new AggregateError([{ name: 'TimeoutError', message: 'PRIVATE_DETAIL' }]), 504, 'LLM_TIMEOUT', 'faster model'],
    [new AggregateError([new InvalidGeneratedPlanError(new Error('PRIVATE_DETAIL'))]), 422, 'LLM_INVALID_PLAN', 'Review the tables'],
    [new Error('PRIVATE_DETAIL'), 502, 'LLM_UNAVAILABLE', 'IT-Admin'],
  ])('returns an actionable safe generation failure', async (error, status, code, guidance) => {
    mock.generate.mockRejectedValueOnce(error)
    const response = await app.inject({ method: 'POST', url: '/api/v1/llm/generate-query', headers: { authorization }, payload: { question: 'List loans', tables: [{ name: 'loans', columns: ['loan_number'] }] } })
    expect(response.statusCode).toBe(status)
    expect(response.json().code).toBe(code)
    expect(response.json().message).toContain(guidance)
    expect(response.body).not.toContain('PRIVATE_DETAIL')
    expect(response.json()).not.toHaveProperty('stack')
  })

  it('uses the same messages for recommendations and filter recommendations', async () => {
    mock.recommend.mockRejectedValueOnce(new AggregateError([{ code: 'ECONNREFUSED' }]))
    const response = await app.inject({ method: 'POST', url: '/api/v1/llm/recommend-selection', headers: { authorization }, payload: { question: 'List loans', tableNames: ['loans'] } })
    expect(response.statusCode).toBe(503)
    expect(response.json().code).toBe('LLM_CONNECTION_FAILED')
    expect(response.json().message).toContain('Ollama')
  })
})