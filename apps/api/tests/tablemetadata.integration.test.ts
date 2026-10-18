import { resolve } from 'node:path'
import { config } from 'dotenv'
import { createMetadataDatabase, eq, TableMetadata } from '@ais/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAccessToken } from '../src/modules/auth/tokens'
import { TableMetadataRepository } from '../src/modules/metadata/tablemetadata.repository'

config({ path: resolve(process.cwd(), '../../.env'), quiet: true })

const metadataDatabaseUrl = process.env.METADATA_DB_URL
const runIntegrationTests = Boolean(
  metadataDatabaseUrl && process.env.RUN_DB_INTEGRATION_TESTS === 'true',
)

if (runIntegrationTests) {
  const connection = createMetadataDatabase()
  const repository = new TableMetadataRepository(connection.db)
  const testRow = {
    name: `vitest-${crypto.randomUUID()}`,
    description: 'Repository integration test row',
    is_active: true,
    is_parent: false,
    is_parentId: 0,
  }
  let insertedId: string | undefined

  beforeAll(async () => {
    const [inserted] = await connection.db.insert(TableMetadata).values(testRow).returning()
    insertedId = inserted?.id
    if (!insertedId) throw new Error('Failed to insert metadata integration test row')
  })

  afterAll(async () => {
    try {
      if (insertedId) {
        await connection.db.delete(TableMetadata).where(eq(TableMetadata.id, insertedId))
      }
    } finally {
      await connection.close()
    }
  })

  it('reads rows from the database', async () => {
    const rows = await repository.getAllTables()
    expect(rows.some((row) => row.id === insertedId)).toBe(true)
  })

  it('finds an inserted row by ID', async () => {
    const row = await repository.getTableById(insertedId!)
    expect(row).toMatchObject({ id: insertedId, ...testRow })
  })

  it('returns null for an ID that does not exist', async () => {
    const row = await repository.getTableById(crypto.randomUUID())
    expect(row).toBeNull()
  })

  it('returns column metadata for a table', async () => { 
    const columns = await repository.getMetadataColumnsByTableId(insertedId!)
    expect(Array.isArray(columns)).toBe(true)
  })

  it('serves active table metadata with columns through the API', async () => {
    const { buildServer } = await import('../src/server')
    const app = await buildServer()
    const accessToken = await createAccessToken({
      id: crypto.randomUUID(),
      email: 'metadata-test@example.test',
    })

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/metadata/schema',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(response.statusCode).toBe(200)

      const result = response.json() as {
        tables: Array<{ name: string; columns: Array<{ name: string }> }>
      }
      const borrowers = result.tables.find((table) => table.name === 'borrowers')

      expect(borrowers?.columns.some((column) => column.name === 'legal_name')).toBe(true)
    } finally {
      await app.close()
    }
  })
}  
else {
  describe.skip('TableMetadataRepository integration', () => {
    it('requires METADATA_DB_URL and RUN_DB_INTEGRATION_TESTS=true', () => {})
  })
}