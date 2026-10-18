import { and, asc, eq, type Database, TableMetadata as tableMetadata, ColumnMetadata as columnMetadata } from '@ais/db'

export type TableMetaDataRow = typeof tableMetadata.$inferSelect
export type ColumnMetadataRow = typeof columnMetadata.$inferSelect

export interface TableMetadataWithColumnsRow {
    table: TableMetaDataRow
    columns: ColumnMetadataRow[]
}

export class TableMetadataRepository {
    constructor(private readonly db: Database) {}

    async getAllTables(): Promise<TableMetaDataRow[]> {
        return this.db.select().from(tableMetadata)
    }

    async getTableById(id: string): Promise<TableMetaDataRow | null> {
        const [result] = await this.db
            .select()
            .from(tableMetadata)
            .where(eq(tableMetadata.id, id))
            .limit(1)
        return result ?? null
    }

    async getMetadataColumnsByTableId(tableId: string): Promise<ColumnMetadataRow[]> {
        return this.db.select().from(columnMetadata).where(eq(columnMetadata.table_id, tableId))
    }

    async getActiveSchema(): Promise<TableMetadataWithColumnsRow[]> {
        const rows = await this.db
            .select({ table: tableMetadata, column: columnMetadata })
            .from(tableMetadata)
            .leftJoin(
                columnMetadata,
                and(
                    eq(columnMetadata.table_id, tableMetadata.id),
                    eq(columnMetadata.is_active, true),
                ),
            )
            .where(eq(tableMetadata.is_active, true))
            .orderBy(asc(tableMetadata.name), asc(columnMetadata.name))

        const tables = new Map<string, TableMetadataWithColumnsRow>()
        for (const row of rows) {
            let table = tables.get(row.table.id)
            if (!table) {
                table = { table: row.table, columns: [] }
                tables.set(row.table.id, table)
            }
            if (row.column) table.columns.push(row.column)
        }

        return [...tables.values()]
    }
}





