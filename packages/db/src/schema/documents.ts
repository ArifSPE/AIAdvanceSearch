import { relations, sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from 'drizzle-orm/pg-core'
import { users } from './users'

export const documentStatus = pgEnum('document_status', ['pending', 'indexed', 'failed'])

/** Number of dimensions produced by the embedding model. Keep in sync with EMBEDDING_DIMENSIONS. */
export const EMBEDDING_DIMENSIONS = 1536

export const documents = pgTable(
  'documents',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    url: text(),
    source: text().notNull().default('upload'),
    content: text().notNull(),
    status: documentStatus().notNull().default('pending'),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('documents_owner_idx').on(table.ownerId),
    index('documents_status_idx').on(table.status),
    // Backs the keyword search in apps/api search.repository.ts
    index('documents_fts_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.title} || ' ' || ${table.content})`,
    ),
  ],
)

/** Chunked text + embedding, the unit that vector search runs over. */
export const documentChunks = pgTable(
  'document_chunks',
  {
    id: uuid().primaryKey().defaultRandom(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    chunkIndex: integer().notNull(),
    content: text().notNull(),
    embedding: vector({ dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('document_chunks_document_chunk_idx').on(table.documentId, table.chunkIndex),
    index('document_chunks_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
  ],
)

export const documentsRelations = relations(documents, ({ one, many }) => ({
  owner: one(users, { fields: [documents.ownerId], references: [users.id] }),
  chunks: many(documentChunks),
}))

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, { fields: [documentChunks.documentId], references: [documents.id] }),
}))

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type DocumentChunk = typeof documentChunks.$inferSelect
export type NewDocumentChunk = typeof documentChunks.$inferInsert
