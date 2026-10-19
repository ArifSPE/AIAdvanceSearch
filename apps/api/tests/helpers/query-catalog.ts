import { metadataTableWithColumnsSchema } from '@ais/shared'

export const testCatalog = [
  { name: 'branches', columns: [{ name: 'id', column_data_type: 'uuid', is_primary_key: true }, { name: 'name', column_data_type: 'text' }] },
  { name: 'borrowers', columns: [{ name: 'id', column_data_type: 'uuid', is_primary_key: true }, { name: 'legal_name', column_data_type: 'text' }, { name: 'branch_id', column_data_type: 'uuid', is_foreign_key: true, parent_table: 'branches' }] },
  { name: 'loans', columns: [{ name: 'id', column_data_type: 'uuid', is_primary_key: true }, { name: 'loan_number', column_data_type: 'text' }, { name: 'outstanding_balance', column_data_type: 'numeric' }, { name: 'status', column_data_type: 'text' }, { name: 'borrower_id', column_data_type: 'uuid', is_foreign_key: true, parent_table: 'borrowers' }] },
].map((table) => metadataTableWithColumnsSchema.parse({
  id: crypto.randomUUID(), name: table.name, display_name: table.name, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', description: '', is_active: true, is_parent: false, is_parentId: 0,
  columns: table.columns.map((column) => ({ id: crypto.randomUUID(), display_name: column.name, is_nullable: false, default_value: '', character_maximum_length: 0, numeric_precision: 14, numeric_scale: 2, is_primary_key: false, is_foreign_key: false, is_unique: false, is_indexed: false, parent_table: null, table_id: crypto.randomUUID(), created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', description: '', is_active: true, ...column })),
}))