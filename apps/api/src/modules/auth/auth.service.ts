import { randomBytes } from 'node:crypto'
import { compare, hash } from 'bcryptjs'
import type { Database } from '@ais/db'
import type { AuthSession, AuthenticatedUser, LoginInput, RegisterInput } from '@ais/shared'
import { AuthRepository, type AuthUserRecord } from './auth.repository'
import { ACCESS_TOKEN_TTL_SECONDS, createAccessToken } from './tokens'

const passwordHashCost = 12
let dummyPasswordHash: Promise<string> | undefined

function getDummyPasswordHash(): Promise<string> {
  dummyPasswordHash ??= hash(randomBytes(32).toString('hex'), passwordHashCost)
  return dummyPasswordHash
}

export class AuthService {
  private readonly repository: AuthRepository

  constructor(db: Database) {
    this.repository = new AuthRepository(db)
  }

  async register(input: RegisterInput): Promise<AuthSession | null> {
    const passwordHash = await hash(input.password, passwordHashCost)
    const user = await this.repository.createUser({
      email: input.email,
      name: input.name ?? null,
      passwordHash,
    })
    return user ? this.createSession(user) : null
  }

  async login(input: LoginInput): Promise<AuthSession | null> {
    const user = await this.repository.findByEmail(input.email)
    const storedHash = user?.passwordHash ?? (await getDummyPasswordHash())
    const matches = await compare(input.password, storedHash)

    return user?.passwordHash && matches ? this.createSession(user) : null
  }

  private async createSession(user: AuthUserRecord): Promise<AuthSession> {
    const authenticatedUser: AuthenticatedUser = { id: user.id, email: user.email, role: user.role }
    return {
      accessToken: await createAccessToken(authenticatedUser),
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: authenticatedUser,
    }
  }
}