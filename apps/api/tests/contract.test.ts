import {
  contract,
  queryGenerationInputSchema,
  SEARCH_LIMIT_DEFAULT,
  searchQuerySchema,
} from '@ais/shared'
import { describe, expect, it } from 'vitest'

describe('searchQuerySchema', () => {
  it('applies pagination defaults', () => {
    const parsed = searchQuerySchema.parse({ q: 'pgvector' })
    expect(parsed).toEqual({ q: 'pgvector', limit: SEARCH_LIMIT_DEFAULT, offset: 0 })
  })

  it('coerces limit and offset from query-string values', () => {
    const parsed = searchQuerySchema.parse({ q: 'hybrid', limit: '5', offset: '10' })
    expect(parsed.limit).toBe(5)
    expect(parsed.offset).toBe(10)
  })

  it('rejects a blank query', () => {
    expect(searchQuerySchema.safeParse({ q: '   ' }).success).toBe(false)
  })

  it('rejects a limit above the maximum', () => {
    expect(searchQuerySchema.safeParse({ q: 'a', limit: 500 }).success).toBe(false)
  })
})

describe('queryGenerationInputSchema', () => {
  it('requires at least one selected column per table', () => {
    expect(
      queryGenerationInputSchema.safeParse({
        question: 'Find large active loans',
        tables: [{ name: 'loans', columns: [] }],
      }).success,
    ).toBe(false)
  })

  it('rejects duplicate table selections', () => {
    expect(
      queryGenerationInputSchema.safeParse({
        question: 'Find large active loans',
        tables: [
          { name: 'loans', columns: ['id'] },
          { name: 'loans', columns: ['status'] },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('contract routes', () => {
  /** Guards the REST surface: a renamed path or method breaks this test, not the client. */
  it('declares the expected REST method and path for every procedure', () => {
    const routes = Object.entries(contract).flatMap(([group, procedures]) =>
      Object.entries(procedures).map(([name, procedure]) => {
        const { method, path } = procedure['~orpc'].route
        return `${method} ${path} -> ${group}.${name}`
      }),
    )

    expect(routes.sort()).toEqual([
      'DELETE /admin/prompts/{id} -> admin.removePrompt',
      'DELETE /documents/{id} -> documents.remove',
      'DELETE /saved-queries/{id} -> savedQueries.remove',
      'GET /admin/prompts -> admin.prompts',
      'GET /admin/providers -> admin.providers',
      'GET /auth/me -> auth.me',
      'GET /documents -> documents.list',
      'GET /documents/{id} -> documents.find',
      'GET /health -> health.check',
      'GET /llm/providers -> llm.providers',
      'GET /metadata/schema -> metadata.schema',
      'GET /prompts -> prompts.list',
      'GET /ready -> health.ready',
      'GET /saved-queries -> savedQueries.list',
      'GET /search -> search.query',
      'PATCH /saved-queries/{id} -> savedQueries.update',
      'POST /auth/login -> auth.login',
      'POST /auth/register -> auth.register',
      'POST /documents -> documents.create',
      'POST /llm/execute-query -> llm.executeQuery',
      'POST /llm/generate-query -> llm.generateQuery',
      'POST /llm/recommend-selection -> llm.recommendSelection',
      'POST /saved-queries -> savedQueries.save',
      'POST /saved-queries/{id}/copy -> savedQueries.copy',
      'POST /saved-queries/{id}/run -> savedQueries.run',
      'PUT /admin/prompts -> admin.savePrompt',
      'PUT /admin/providers -> admin.saveProvider',
    ])
  })

  it('sets the status codes the REST surface promises', () => {
    expect(contract.documents.create['~orpc'].route.successStatus).toBe(201)
    expect(contract.documents.remove['~orpc'].route.successStatus).toBe(204)
    expect(contract.auth.register['~orpc'].route.successStatus).toBe(201)
  })
})
