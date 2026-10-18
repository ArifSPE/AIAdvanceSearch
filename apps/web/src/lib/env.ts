/** Browser-visible config. NEXT_PUBLIC_API_URL is injected in next.config.ts. */
export const clientEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1',
} as const
