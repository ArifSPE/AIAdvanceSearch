import { resolve } from 'node:path'
import { config } from 'dotenv'
import { eq, users } from '@ais/db'
import { afterAll, describe, expect, it } from 'vitest'

config({ path: resolve(process.cwd(), '../../.env'), quiet: true })

const runIntegrationTests = Boolean(
  process.env.APP_DB_URL &&
    process.env.METADATA_DB_URL &&
    process.env.RUN_DB_INTEGRATION_TESTS === 'true',
)

if (runIntegrationTests) {
  describe('authentication API integration', () => {
    it('registers, signs in, and protects business endpoints', async () => {
      const { buildServer } = await import('../src/server')
      const app = await buildServer()
      const email = `auth-${crypto.randomUUID()}@example.test`
      let userId: string | undefined

      try {
        const registerResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          payload: {
            email,
            name: 'Integration Test User',
            password: 'correct horse battery staple',
          },
        })
        expect(registerResponse.statusCode).toBe(201)
        const registration = registerResponse.json() as {
          accessToken: string
          user: { id: string; email: string }
        }
        userId = registration.user.id
        expect(registration.user.email).toBe(email)
        expect(registration.accessToken).toBeTruthy()

        const protectedWithoutToken = await app.inject({
          method: 'GET',
          url: '/api/v1/metadata/schema',
        })
        expect(protectedWithoutToken.statusCode).toBe(401)

        const meResponse = await app.inject({
          method: 'GET',
          url: '/api/v1/auth/me',
          headers: { authorization: `Bearer ${registration.accessToken}` },
        })
        expect(meResponse.statusCode).toBe(200)
        expect(meResponse.json()).toEqual(registration.user)

        const loginResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email, password: 'correct horse battery staple' },
        })
        expect(loginResponse.statusCode).toBe(200)

        const failedLoginResponse = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email, password: 'incorrect password' },
        })
        expect(failedLoginResponse.statusCode).toBe(401)
      } finally {
        if (userId) await app.db.delete(users).where(eq(users.id, userId))
        await app.close()
      }
    })
  })
} else {
  describe.skip('authentication API integration', () => {
    it('requires both DB URLs and RUN_DB_INTEGRATION_TESTS=true', () => {})
  })
}