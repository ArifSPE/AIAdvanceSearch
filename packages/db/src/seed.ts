import { createAppDatabase, createMetadataDatabase } from './client'
import { loadDatabaseUrl } from './env'
import { documents, users } from './schema/index'
import { seedLendingData } from './lending.seed'
import { seedLendingMetadata } from './metadata.seed'

const SEED_USER = { email: 'dev@example.com', name: 'Dev User' }

const SEED_DOCUMENTS = [
  {
    id: '80000000-0000-4000-8000-000000000001',
    title: 'Vector search with pgvector',
    url: 'https://github.com/pgvector/pgvector',
    source: 'docs',
    content:
      'pgvector adds a vector column type to Postgres along with HNSW and IVFFlat indexes. ' +
      'Cosine distance is the usual choice for normalised embeddings, and an HNSW index gives ' +
      'approximate nearest neighbour lookups fast enough for interactive search.',
  },
  {
    id: '80000000-0000-4000-8000-000000000002',
    title: 'Full-text search in Postgres',
    url: 'https://www.postgresql.org/docs/current/textsearch.html',
    source: 'docs',
    content:
      'Postgres full-text search converts documents to tsvector and queries to tsquery. ' +
      'websearch_to_tsquery accepts Google-style operators, ts_rank orders results by relevance, ' +
      'and ts_headline produces highlighted snippets for the result list.',
  },
  {
    id: '80000000-0000-4000-8000-000000000003',
    title: 'Hybrid retrieval',
    url: null,
    source: 'notes',
    content:
      'Hybrid retrieval blends lexical BM25-style scoring with dense vector similarity. ' +
      'Reciprocal rank fusion is a simple way to merge the two ranked lists without tuning weights, ' +
      'and it tends to beat either retriever used alone.',
  },
]

async function main() {
  loadDatabaseUrl()
  if (!process.env.METADATA_DB_URL) throw new Error('METADATA_DB_URL is not set.')

  const appConnection = createAppDatabase({ max: 1 })
  const metadataConnection = createMetadataDatabase({ max: 1 })

  try {
    const [user] = await appConnection.db
      .insert(users)
      .values(SEED_USER)
      .onConflictDoUpdate({ target: users.email, set: { name: SEED_USER.name } })
      .returning()

    if (!user) throw new Error('failed to upsert the seed user')

    await appConnection.db
      .insert(documents)
      .values(SEED_DOCUMENTS.map((doc) => ({ ...doc, ownerId: user.id, status: 'indexed' as const })))
      .onConflictDoNothing({ target: documents.id })

    await seedLendingData(appConnection.db)
    const metadataColumnCount = await seedLendingMetadata(appConnection, metadataConnection.db)

    console.log(
      `seeded user ${user.email}, ${SEED_DOCUMENTS.length} documents, lending demo data, and ${metadataColumnCount} metadata columns`,
    )
  } finally {
    await Promise.all([appConnection.close(), metadataConnection.close()])
  }
}

main().catch((error) => {
  console.error('seed failed:', error)
  process.exit(1)
})
