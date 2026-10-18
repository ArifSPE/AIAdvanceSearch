import { z } from 'zod'

function utf8ByteLength(value: string): number {
  let byteLength = 0
  for (const character of value) {
    const codePoint = character.codePointAt(0)!
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4
  }
  return byteLength
}

const passwordSchema = z
  .string()
  .min(12, 'password must be at least 12 characters')
  .max(72)
  .refine((password) => utf8ByteLength(password) <= 72, {
    message: 'password must be no more than 72 UTF-8 bytes',
  })

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().min(1).max(120).optional(),
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z
    .string()
    .min(1)
    .max(72)
    .refine((password) => utf8ByteLength(password) <= 72, {
      message: 'password must be no more than 72 UTF-8 bytes',
    }),
})

export const authenticatedUserSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  role: z.enum(['User', 'IT-Admin']).default('User'),
})

export const authSessionSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
  user: authenticatedUserSchema,
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>
export type AuthSession = z.infer<typeof authSessionSchema>