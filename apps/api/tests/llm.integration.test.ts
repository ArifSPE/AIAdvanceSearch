import { resolve } from 'node:path'
import { config } from 'dotenv'
import { afterAll, describe, expect, it } from 'vitest'
import { createAccessToken } from '../src/modules/auth/tokens'
import { createGeneratedQueryToken } from '../src/modules/llm/query-token'
import { users, eq } from '@ais/db'
import { grantFixtureBranches, loanDraft } from './helpers/query-draft'

config({ path: resolve(process.cwd(), '../../.env'), quiet: true })

const runIntegrationTests = Boolean(
  process.env.APP_DB_URL &&
    process.env.METADATA_DB_URL &&
    process.env.RUN_DB_INTEGRATION_TESTS === 'true',
)

if (runIntegrationTests) {
  describe('LLM query-generation API integration', () => {
    let app: Awaited<ReturnType<(typeof import('../src/server'))['buildServer']>> | undefined
    let executionUserId: string | undefined

    afterAll(async () => {
      if (app && executionUserId) await app.db.delete(users).where(eq(users.id, executionUserId))
      await app?.close()
    })

    it('requires authentication', async () => {
      const { buildServer } = await import('../src/server')
      app = await buildServer()

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/llm/generate-query',
        payload: {
          question: 'Find active loans',
          tables: [{ name: 'loans', columns: ['loan_number'] }],
        },
      })

      expect(response.statusCode).toBe(401)
    })

    it('rejects tables outside active metadata before calling a provider', async () => {
      const { buildServer } = await import('../src/server')
      app ??= await buildServer()
      const accessToken = await createAccessToken({
        id: crypto.randomUUID(),
        email: 'llm-test@example.test',
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/llm/generate-query',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          question: 'Read private table data',
          tables: [{ name: 'private_data', columns: ['id'] }],
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('executes a signed read-only query and binds its token to the user', async () => {
      const { buildServer } = await import('../src/server')
      app ??= await buildServer()
      const user = { id: crypto.randomUUID(), email: 'llm-run-test@example.test' }
      executionUserId = user.id
      await app.db.insert(users).values(user)
      await grantFixtureBranches(app.db, user.id)
      const accessToken = await createAccessToken(user)
      const queryToken = (await loanDraft(app.metadataDb, user.id, { columns: ['loan_number', 'outstanding_balance'], order: 'asc', question: 'List loans' })).token

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/llm/execute-query',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { queryToken },
      })

      expect(response.statusCode).toBe(200)
      const result = response.json() as {
        model: string
        result: { columns: Array<{ name: string }>; rows: Array<Record<string, unknown>> }
      }
      expect(result.model).toBe('test-model')
      expect(result.result.columns.map((column) => column.name)).toEqual([
        'loan_number',
        'outstanding_balance',
      ])
      expect(result.result.rows.length).toBeGreaterThan(0)

      const otherUserToken = await createAccessToken({
        id: crypto.randomUUID(),
        email: 'other-user@example.test',
      })
      const otherUserResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/llm/execute-query',
        headers: { authorization: `Bearer ${otherUserToken}` },
        payload: { queryToken },
      })
      expect(otherUserResponse.statusCode).toBe(401)
    })
  })
} else {
  describe.skip('LLM query-generation API integration', () => {
    it('requires both DB URLs and RUN_DB_INTEGRATION_TESTS=true', () => {})
  })
}