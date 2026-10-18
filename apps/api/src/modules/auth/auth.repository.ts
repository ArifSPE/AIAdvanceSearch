import { eq, type Database, users } from '@ais/db'

export interface AuthUserRecord {
  id: string
  email: string
  name: string | null
  passwordHash: string | null
  role: 'User' | 'IT-Admin'
}

export class AuthRepository {
  constructor(private readonly db: Database) {}

  async createUser(input: {
    email: string
    name: string | null
    passwordHash: string
  }): Promise<AuthUserRecord | null> {
    const [user] = await this.db
      .insert(users)
      .values(input)
      .onConflictDoNothing({ target: users.email })
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
        role: users.role,
      })
    return user ?? null
  }

  async findByEmail(email: string): Promise<AuthUserRecord | null> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        passwordHash: users.passwordHash,
        role: users.role,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    return user ?? null
  }
}