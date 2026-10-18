import { createAppDatabase, eq, savedQueries, users } from '@ais/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAccessToken } from '../src/modules/auth/tokens'
import { createGeneratedQueryToken } from '../src/modules/llm/query-token'
import { defineQueryFilter } from '@ais/shared'
import { TableMetadataService } from '../src/modules/metadata/tablemetadata.service'
import { addQueryFilters } from '../src/modules/llm/query-filters'

describe.skipIf(process.env.RUN_DB_INTEGRATION_TESTS !== 'true')('Saved queries API integration', () => {
  let app: Awaited<ReturnType<(typeof import('../src/server'))['buildServer']>>
  let connection: ReturnType<typeof createAppDatabase>
  const userId = crypto.randomUUID()
  let authorization: string
  let otherAuthorization: string
  let savedId: string
  let queryToken: string
  const name = `Loans ${crypto.randomUUID()}`

  beforeAll(async () => {
    const { buildServer } = await import('../src/server')
    app = await buildServer()
    connection = createAppDatabase({ max: 1 })
    await connection.db.insert(users).values({ id: userId, email: `saved-${userId}@example.test` })
    authorization = `Bearer ${await createAccessToken({ id: userId, email: `saved-${userId}@example.test` })}`
    otherAuthorization = `Bearer ${await createAccessToken({ id: crypto.randomUUID(), email: 'other-saved@example.test' })}`
    queryToken = await createGeneratedQueryToken(userId, {
      question: 'List loans',
      sql: 'SELECT loan_number FROM loans ORDER BY loan_number',
      explanation: 'Lists loans.',
      provider: 'ollama',
      model: 'test-model',
      tables: [{ name: 'loans', columns: ['loan_number'] }],
      columnTypes: { 'loans.loan_number': 'text' },
    })
  })

  afterAll(async () => {
    try {
      await connection?.db.delete(users).where(eq(users.id, userId))
    } finally {
      await Promise.all([app?.close(), connection?.close()])
    }
  })

  it('requires authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/saved-queries' })
    expect(response.statusCode).toBe(401)
  })

  it('allows the browser DELETE preflight', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: `/api/v1/saved-queries/${crypto.randomUUID()}`,
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'DELETE',
        'access-control-request-headers': 'authorization',
      },
    })
    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-methods']).toContain('DELETE')
  })

  it('rejects forged query tokens', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/saved-queries', headers: { authorization }, payload: { name, queryToken: 'forged' } })
    expect(response.statusCode).toBe(401)
  })

  it('saves a signed draft and preserves its question and output order', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/saved-queries', headers: { authorization }, payload: { name, queryToken, outputOrder: ['loans.loan_number'] } })
    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({ name, question: 'List loans', outputOrder: ['loans.loan_number'] })
    savedId = response.json().id
  })

  it('rejects duplicate names for the same user', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/saved-queries', headers: { authorization }, payload: { name, queryToken } })
    expect(response.statusCode).toBe(409)
  })

  it('lists only the owner queries and denies cross-user run and delete', async () => {
    const owner = await app.inject({ method: 'GET', url: '/api/v1/saved-queries', headers: { authorization } })
    expect(owner.json().items.some((item: { id: string }) => item.id === savedId)).toBe(true)
    const other = await app.inject({ method: 'GET', url: '/api/v1/saved-queries', headers: { authorization: otherAuthorization } })
    expect(other.json().items).toEqual([])
    for (const [method, suffix] of [['POST', '/run'], ['DELETE', '']] as const) {
      const response = await app.inject({ method, url: `/api/v1/saved-queries/${savedId}${suffix}`, headers: { authorization: otherAuthorization } })
      expect(response.statusCode).toBe(404)
    }
  })

  it('runs repeatedly by ID without needing the original token or calling an LLM', async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${savedId}/run`, headers: { authorization } })
      expect(response.statusCode).toBe(200)
      expect(response.json().result.columns.map((column: { name: string }) => column.name)).toEqual(['loan_number'])
      expect(response.json().result.rows.length).toBeGreaterThan(0)
    }
    const response = await app.inject({ method: 'GET', url: '/api/v1/saved-queries', headers: { authorization } })
    expect(response.json().items.find((item: { id: string }) => item.id === savedId).lastRunAt).not.toBeNull()
  })

  it('persists typed defaults and executes different bound values without modifying the saved defaults', async () => {
    const { tables } = await new TableMetadataService(app.metadataDb).getSchema()
    const table = tables.find((candidate) => candidate.name === 'loans')!
    const numericColumn = table.columns.find((column) => column.name === 'outstanding_balance')!
    const statusColumn = table.columns.find((column) => column.name === 'status')!
    expect(statusColumn.allowed_values).toContain('active')
    const filters = [
      defineQueryFilter({ id: 'minimum_balance', table: 'loans', column: 'outstanding_balance', operator: 'gte', defaultValue: '500000' }, numericColumn, table.display_name),
      defineQueryFilter({ id: 'loan_status', table: 'loans', column: 'status', operator: 'eq', defaultValue: 'active' }, statusColumn, table.display_name),
    ]
    const parameterizedSql = addQueryFilters('SELECT loan_number, outstanding_balance FROM loans ORDER BY loan_number', filters)
    const draft = await createGeneratedQueryToken(userId, {
      question: 'List active high-balance loans', sql: parameterizedSql, explanation: 'Lists active loans with an editable minimum balance.',
      provider: 'ollama', model: 'test-model', tables: [{ name: 'loans', columns: ['loan_number', 'outstanding_balance', 'status'] }],
      columnTypes: { 'loans.loan_number': 'text', 'loans.outstanding_balance': 'numeric', 'loans.status': 'loan_status' }, filters,
    })
    const saved = await app.inject({ method: 'POST', url: '/api/v1/saved-queries', headers: { authorization }, payload: { name: `${name} parameters`, queryToken: draft, filterValues: { minimum_balance: '700000' } } })
    expect(saved.statusCode).toBe(201)
    expect(saved.json().filters[0].defaultValue).toBe('700000')
    expect(saved.json().sql).toContain('$1')
    const id = saved.json().id
    const lower = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${id}/run`, headers: { authorization }, payload: { filterValues: { minimum_balance: '0' } } })
    expect(lower.statusCode).toBe(200)
    expect(lower.json().result.rowCount).toBeGreaterThan(0)
    const higher = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${id}/run`, headers: { authorization }, payload: { filterValues: { minimum_balance: '99999999999' } } })
    expect(higher.statusCode).toBe(200)
    expect(higher.json().result.rowCount).toBe(0)
    for (const values of [{ minimum_balance: 'not-numeric' }, { loan_status: 'invalid-status' }, { unknown_filter: 'x' }]) {
      const invalid = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${id}/run`, headers: { authorization }, payload: { filterValues: values } })
      expect(invalid.statusCode).toBe(400)
    }
    const direct = await app.inject({ method: 'POST', url: '/api/v1/llm/execute-query', headers: { authorization }, payload: { queryToken: draft, filterValues: { minimum_balance: '99999999999' } } })
    expect(direct.statusCode).toBe(200)
    expect(direct.json().result.rowCount).toBe(0)
    const all = await app.inject({ method: 'GET', url: '/api/v1/saved-queries', headers: { authorization } })
    expect(all.json().items.find((query: { id: string }) => query.id === id).filters[0].defaultValue).toBe('700000')
    const copy = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${id}/copy`, headers: { authorization }, payload: { name: `${name} parameters copy` } })
    expect(copy.statusCode).toBe(201)
    expect(copy.json().filters).toEqual(saved.json().filters)
    const invalidSave = await app.inject({ method: 'POST', url: '/api/v1/saved-queries', headers: { authorization }, payload: { name: `${name} bad defaults`, queryToken: draft, filterValues: { minimum_balance: 'bad' } } })
    expect(invalidSave.statusCode).toBe(400)
  })

  it('treats SQL-looking input as data when running a saved text filter', async () => {
    const { tables } = await new TableMetadataService(app.metadataDb).getSchema()
    const table = tables.find((candidate) => candidate.name === 'loans')!
    const column = table.columns.find((candidate) => candidate.name === 'loan_number')!
    const filter = defineQueryFilter({ id: 'loan_number', table: 'loans', column: 'loan_number', operator: 'eq', defaultValue: 'LN-1001' }, column, table.display_name)
    const draft = await createGeneratedQueryToken(userId, {
      question: 'Find a loan by number', sql: addQueryFilters('SELECT loan_number FROM loans', [filter]), explanation: 'Exact loan number lookup.',
      provider: 'ollama', model: 'test-model', tables: [{ name: 'loans', columns: ['loan_number'] }], columnTypes: { 'loans.loan_number': 'text' }, filters: [filter],
    })
    const saved = await app.inject({ method: 'POST', url: '/api/v1/saved-queries', headers: { authorization }, payload: { name: `${name} text filter`, queryToken: draft } })
    expect(saved.statusCode).toBe(201)
    const match = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${saved.json().id}/run`, headers: { authorization } })
    expect(match.statusCode).toBe(200)
    expect(match.json().result.rowCount).toBe(1)
    const hostile = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${saved.json().id}/run`, headers: { authorization }, payload: { filterValues: { loan_number: "LN-1001' OR 1=1 --" } } })
    expect(hostile.statusCode).toBe(200)
    expect(hostile.json().result.rowCount).toBe(0)
  })

  it('allows browser PATCH preflight', async () => {
    const response = await app.inject({ method: 'OPTIONS', url: `/api/v1/saved-queries/${savedId}`, headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'PATCH' } })
    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-methods']).toContain('PATCH')
  })

  it('renames without changing SQL and duplicates without replacing the original', async () => {
    const renamed = await app.inject({ method: 'PATCH', url: `/api/v1/saved-queries/${savedId}`, headers: { authorization }, payload: { name: `${name} renamed` } })
    expect(renamed.statusCode).toBe(200)
    expect(renamed.json()).toMatchObject({ id: savedId, name: `${name} renamed`, sql: 'SELECT loan_number FROM loans ORDER BY loan_number' })
    const copy = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${savedId}/copy`, headers: { authorization }, payload: { name: `${name} copy` } })
    expect(copy.statusCode).toBe(201)
    expect(copy.json().id).not.toBe(savedId)
    expect(copy.json()).toMatchObject({ sql: renamed.json().sql, outputOrder: ['loans.loan_number'], lastRunAt: null })
    const conflict = await app.inject({ method: 'PATCH', url: `/api/v1/saved-queries/${savedId}`, headers: { authorization }, payload: { name: `${name} copy` } })
    expect(conflict.statusCode).toBe(409)
  })

  it('denies cross-user rename and copy and rejects forged updates', async () => {
    for (const [method, suffix] of [['PATCH', ''], ['POST', '/copy']] as const) {
      const response = await app.inject({ method, url: `/api/v1/saved-queries/${savedId}${suffix}`, headers: { authorization: otherAuthorization }, payload: { name: 'Not mine' } })
      expect(response.statusCode).toBe(404)
    }
    const forged = await app.inject({ method: 'PATCH', url: `/api/v1/saved-queries/${savedId}`, headers: { authorization }, payload: { name, queryToken: 'forged' } })
    expect(forged.statusCode).toBe(401)
  })

  it('updates a query from a signed draft while keeping its ID', async () => {
    const token = await createGeneratedQueryToken(userId, {
      question: 'List latest loan numbers', sql: 'SELECT loan_number FROM loans ORDER BY loan_number DESC', explanation: 'Lists loan numbers descending.',
      provider: 'ollama', model: 'test-model', tables: [{ name: 'loans', columns: ['loan_number'] }], columnTypes: { 'loans.loan_number': 'text' },
    })
    const response = await app.inject({ method: 'PATCH', url: `/api/v1/saved-queries/${savedId}`, headers: { authorization }, payload: { name, queryToken: token, outputOrder: ['loans.loan_number'] } })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ id: savedId, name, question: 'List latest loan numbers', sql: 'SELECT loan_number FROM loans ORDER BY loan_number DESC', lastRunAt: null })
  })

  it('rejects outdated metadata before executing SQL', async () => {
    await connection.db.update(savedQueries).set({ tables: [{ name: 'removed_table', columns: ['id'] }] }).where(eq(savedQueries.id, savedId))
    const response = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${savedId}/run`, headers: { authorization } })
    expect(response.statusCode).toBe(409)
  })

  it('deletes the owner query and returns not found on a later run', async () => {
    const response = await app.inject({ method: 'DELETE', url: `/api/v1/saved-queries/${savedId}`, headers: { authorization } })
    expect(response.statusCode).toBe(204)
    const run = await app.inject({ method: 'POST', url: `/api/v1/saved-queries/${savedId}/run`, headers: { authorization } })
    expect(run.statusCode).toBe(404)
  })
})