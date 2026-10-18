import type { AuthenticatedUser } from '@ais/shared'
import { jwtVerify, SignJWT } from 'jose'
import { jwtSecret } from '../../config/env'

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60

const issuer = 'ai-advance-search-api'
const audience = 'ai-advance-search-client'
const signingKey = new TextEncoder().encode(jwtSecret)

export async function createAccessToken(user: Pick<AuthenticatedUser, 'id' | 'email'>): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(signingKey)
}

export async function getAuthenticatedUser(
  authorizationHeader: string | undefined,
): Promise<AuthenticatedUser | null> {
  if (!authorizationHeader) return null

  const [scheme, token, ...extra] = authorizationHeader.trim().split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length > 0) return null

  try {
    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ['HS256'],
      issuer,
      audience,
      clockTolerance: 5,
    })
    if (!payload.sub || typeof payload.email !== 'string') return null
    return { id: payload.sub, email: payload.email, role: 'User' }
  } catch {
    return null
  }
}