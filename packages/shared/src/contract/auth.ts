import { oc } from '@orpc/contract'
import { authSessionSchema, authenticatedUserSchema, loginSchema, registerSchema } from '../schemas/auth'
import { unauthorizedError } from './errors'

export const authContract = {
  register: oc
    .route({
      method: 'POST',
      path: '/auth/register',
      summary: 'Register an account',
      tags: ['Authentication'],
      successStatus: 201,
    })
    .errors({
      EMAIL_TAKEN: { message: 'An account with this email already exists', status: 409 },
    })
    .input(registerSchema)
    .output(authSessionSchema),

  login: oc
    .route({
      method: 'POST',
      path: '/auth/login',
      summary: 'Sign in',
      tags: ['Authentication'],
    })
    .errors({ UNAUTHORIZED: { message: 'Email or password is incorrect', status: 401 } })
    .input(loginSchema)
    .output(authSessionSchema),

  me: oc
    .route({
      method: 'GET',
      path: '/auth/me',
      summary: 'Get the authenticated user',
      tags: ['Authentication'],
    })
    .errors(unauthorizedError)
    .output(authenticatedUserSchema),
}