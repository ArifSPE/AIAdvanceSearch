import { llmProviderSchema, queryFilterSchema } from '@ais/shared'
import { jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'
import { jwtSecret } from '../../config/env'

const tokenTtlSeconds = 10 * 60
const tokenIssuer = 'ai-advance-search-api'
const tokenAudience = 'generated-query-execution'
const signingKey = new TextEncoder().encode(jwtSecret)

const generatedQueryTokenPayloadSchema = z.object({
  sql: z.string().min(1).max(20000),
  explanation: z.string().min(1).max(4000),
  question: z.string().max(2000).optional(),
  provider: llmProviderSchema,
  model: z.string().min(1),
  tables: z
    .array(
      z.object({
        name: z.string().min(1),
        columns: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1)
    .max(8),
  columnTypes: z.record(z.string(), z.string()),
  filters: z.array(queryFilterSchema).max(20).optional(),
})

export type GeneratedQueryTokenPayload = z.infer<typeof generatedQueryTokenPayloadSchema>

export class InvalidGeneratedQueryTokenError extends Error {
  constructor() {
    super('Generated query token is invalid, expired, or belongs to another user')
    this.name = 'InvalidGeneratedQueryTokenError'
  }
}

export async function createGeneratedQueryToken(
  userId: string,
  payload: GeneratedQueryTokenPayload,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(tokenIssuer)
    .setAudience(tokenAudience)
    .setIssuedAt()
    .setExpirationTime(`${tokenTtlSeconds}s`)
    .sign(signingKey)
}

export async function verifyGeneratedQueryToken(
  token: string,
  userId: string,
): Promise<GeneratedQueryTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ['HS256'],
      issuer: tokenIssuer,
      audience: tokenAudience,
      subject: userId,
      clockTolerance: 5,
    })
    return generatedQueryTokenPayloadSchema.parse(payload)
  } catch {
    throw new InvalidGeneratedQueryTokenError()
  }
}