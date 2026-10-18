import { defineConfig } from 'drizzle-kit'
import { loadDatabaseUrl } from './src/env'

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: loadDatabaseUrl('METADATA_DB_URL'),
  },
  casing: 'snake_case',
  verbose: true,
  strict: true,
})