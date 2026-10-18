import { boolean, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const llmProviderKind = pgEnum('llm_provider_kind', ['ollama', 'openai', 'anthropic', 'bedrock'])

export const llmProviderSettings = pgTable('llm_provider_settings', {
  provider: llmProviderKind().primaryKey(),
  label: text().notNull(),
  model: text().notNull(),
  fallbackModel: text(),
  models: text().array().notNull(),
  enabled: boolean().notNull().default(true),
  isDefault: boolean().notNull().default(false),
  awsRegion: text(),
  awsProfile: text(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex('llm_provider_settings_one_default_idx').on(table.isDefault).where(sql`${table.isDefault} = true`)])

export const curatedPrompts = pgTable('curated_prompts', {
  id: uuid().primaryKey().defaultRandom(),
  label: text().notNull(),
  category: text().notNull(),
  question: text().notNull(),
  enabled: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
})