import { AuthService } from '../modules/auth/auth.service'
import { eq, users } from '@ais/db'
import { ORPCError } from '@orpc/server'
import { pub, requireAuth } from '../orpc/base'

export const authRouter = {
  register: pub.auth.register.handler(async ({ input, context, errors }) => {
    const session = await new AuthService(context.db).register(input)
    if (!session) throw errors.EMAIL_TAKEN()
    return session
  }),

  login: pub.auth.login.handler(async ({ input, context, errors }) => {
    const session = await new AuthService(context.db).login(input)
    if (!session) throw errors.UNAUTHORIZED()
    return session
  }),

  me: pub.auth.me.use(requireAuth).handler(async ({ context }) => {
    const [user] = await context.db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, context.authUser.id)).limit(1)
    if (!user) throw new ORPCError('UNAUTHORIZED', { status: 401, message: 'User is no longer available' })
    return user
  }),
}