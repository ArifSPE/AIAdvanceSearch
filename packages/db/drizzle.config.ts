import { defineConfig } from 'drizzle-kit'
import { loadDatabaseUrl } from './src/env'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: loadDatabaseUrl(),
  },
  // Lets schema files omit explicit column names: `createdAt` -> `created_at`.
  casing: 'snake_case',
  verbose: true,
  strict: true,
})
