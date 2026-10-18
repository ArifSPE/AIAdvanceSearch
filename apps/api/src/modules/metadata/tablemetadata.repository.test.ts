import type { Database } from '@ais/db'
import { describe, expect, it, vi } from 'vitest'
import { TableMetadataRepository } from './tablemetadata.repository'

function createDatabaseMock(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows)
  const where = vi.fn(() => ({ limit }))
  const from = vi.fn(() => ({
    where,
    limit,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  }))
  const select = vi.fn(() => ({ from }))

  return {
    db: { select } as unknown as Database,
    select,
    from,
    where,
    limit,
  }
}

describe('TableMetadataRepository', () => {
  it('returns all table metadata rows', async () => {
    const rows = [{ id: 'table-1', name: 'documents' }]
    const mock = createDatabaseMock(rows)
    const repository = new TableMetadataRepository(mock.db)

    await expect(repository.getAllTables()).resolves.toEqual(rows)
    expect(mock.select).toHaveBeenCalledOnce()
    expect(mock.from).toHaveBeenCalledOnce()
  })

  it('returns a table metadata row by ID', async () => {
    const row = { id: 'table-1', name: 'documents' }
    const mock = createDatabaseMock([row])
    const repository = new TableMetadataRepository(mock.db)

    await expect(repository.getTableById(row.id)).resolves.toEqual(row)
    expect(mock.where).toHaveBeenCalledOnce()
    expect(mock.limit).toHaveBeenCalledWith(1)
  })

  it('returns null when the ID does not exist', async () => {
    const mock = createDatabaseMock([])
    const repository = new TableMetadataRepository(mock.db)

    await expect(repository.getTableById('missing-id')).resolves.toBeNull()
  })
})

describe('getMetadataColumnsByTableId', () => {
  it('returns metadata columns for a given table ID', async () => {
    const columns = [{ id: 'column-1', table_id: 'table-1', name: 'column_name' }]
    const where = vi.fn().mockResolvedValue(columns)
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    const db = { select } as unknown as Database
    const repository = new TableMetadataRepository(db)

    await expect(repository.getMetadataColumnsByTableId('table-1')).resolves.toEqual(columns)
    expect(where).toHaveBeenCalledOnce()
 })

})