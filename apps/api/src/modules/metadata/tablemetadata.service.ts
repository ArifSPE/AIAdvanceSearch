import type { Database } from '@ais/db'
import type { MetadataSchemaResponse, MetadataTableWithColumns } from '@ais/shared'
import { TableMetadataRepository } from './tablemetadata.repository'

export class TableMetadataService {
  private readonly repository: TableMetadataRepository

  constructor(db: Database) {
    this.repository = new TableMetadataRepository(db)
  }

  async getSchema(): Promise<MetadataSchemaResponse> {
    const rows = await this.repository.getActiveSchema()
    const tables: MetadataTableWithColumns[] = rows.map(({ table, columns }) => ({
      ...table,
      display_name: table.display_name || table.name,
      created_at: table.created_at.toISOString(),
      updated_at: table.updated_at.toISOString(),
      columns: columns.map((column) => ({
        ...column,
        display_name: column.display_name || column.name,
        created_at: column.created_at.toISOString(),
        updated_at: column.updated_at.toISOString(),
      })),
    }))

    return { tables }
  }
}