import { inArray } from 'drizzle-orm'
import type { AppDatabaseHandle, Database } from './client'
import { ColumnMetadata as columnMetadata, TableMetadata as tableMetadata } from './schema/metadatatables'

const TABLE_DESCRIPTIONS: Record<string, string> = {
  branches: 'Commercial banking branches and their geographic regions.',
  relationship_managers: 'Relationship managers assigned to branches and borrower accounts.',
  borrowers: 'Synthetic small and medium business borrower profiles and portfolio assignments.',
  loans: 'Commercial loan balances, products, status, and maturity dates.',
  loan_payments: 'Scheduled and recorded borrower loan payments, including missed payments.',
  collateral: 'Assets pledged against loans, including current appraised value.',
  customer_contacts: 'Relationship manager interactions and outcomes for borrower accounts.',
}

const COLUMN_DESCRIPTIONS: Record<string, string> = {
  'branches.code': 'Unique short code identifying the branch.',
  'branches.region': 'Geographic banking region for the branch.',
  'relationship_managers.branch_id': 'Branch where the relationship manager is assigned.',
  'borrowers.external_id': 'Synthetic external identifier for the borrower.',
  'borrowers.legal_name': 'Borrower organization legal name.',
  'borrowers.annual_revenue': 'Most recently reported annual revenue in USD.',
  'borrowers.risk_rating': 'Portfolio risk classification assigned to the borrower.',
  'borrowers.branch_id': 'Branch responsible for the borrower relationship.',
  'borrowers.relationship_manager_id': 'Relationship manager assigned to the borrower.',
  'loans.loan_number': 'Unique loan identifier displayed to analysts.',
  'loans.product_type': 'Commercial loan product category.',
  'loans.principal_amount': 'Original funded principal in USD.',
  'loans.outstanding_balance': 'Current unpaid loan balance in USD.',
  'loans.status': 'Current lifecycle status of the loan.',
  'loans.maturity_date': 'Date the loan is scheduled to mature.',
  'loans.next_payment_date': 'Next scheduled payment date, when available.',
  'loan_payments.loan_id': 'Loan associated with this payment.',
  'loan_payments.due_date': 'Scheduled payment due date.',
  'loan_payments.status': 'Payment state, such as paid, missed, partial, or pending.',
  'collateral.loan_id': 'Loan secured by this collateral asset.',
  'collateral.appraised_value': 'Most recent appraised collateral value in USD.',
  'customer_contacts.borrower_id': 'Borrower associated with the customer interaction.',
  'customer_contacts.contacted_at': 'Timestamp when the interaction occurred.',
}

const PARENT_TABLES = new Set(['branches', 'relationship_managers', 'borrowers', 'loans'])

/** Tables the generated-query role may read. */
export const LENDING_TABLE_NAMES = Object.keys(TABLE_DESCRIPTIONS)

interface ColumnCatalogRow {
  table_name: string
  column_name: string
  column_data_type: string
  is_nullable: boolean
  default_value: string
  character_maximum_length: number
  numeric_precision: number
  numeric_scale: number
  is_primary_key: boolean
  is_foreign_key: boolean
  is_unique: boolean
  is_indexed: boolean
  parent_table: string | null
}

const COLUMN_CATALOG_QUERY = `
  SELECT
    c.table_name,
    c.column_name,
    CASE WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name ELSE c.data_type END AS column_data_type,
    c.is_nullable = 'YES' AS is_nullable,
    COALESCE(c.column_default, '') AS default_value,
    COALESCE(c.character_maximum_length, 0)::integer AS character_maximum_length,
    COALESCE(c.numeric_precision, 0)::integer AS numeric_precision,
    COALESCE(c.numeric_scale, 0)::integer AS numeric_scale,
    EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
        AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = c.table_schema
        AND tc.table_name = c.table_name
        AND kcu.column_name = c.column_name
        AND tc.constraint_type = 'PRIMARY KEY'
    ) AS is_primary_key,
    EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
        AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = c.table_schema
        AND tc.table_name = c.table_name
        AND kcu.column_name = c.column_name
        AND tc.constraint_type = 'FOREIGN KEY'
    ) AS is_foreign_key,
    EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
        AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = c.table_schema
        AND tc.table_name = c.table_name
        AND kcu.column_name = c.column_name
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    ) AS is_unique,
    EXISTS (
      SELECT 1
      FROM pg_catalog.pg_index i
      JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
      WHERE n.nspname = c.table_schema
        AND t.relname = c.table_name
        AND a.attname = c.column_name
    ) AS is_indexed,
    (
      SELECT ccu.table_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_schema = tc.constraint_schema
        AND kcu.constraint_name = tc.constraint_name
        AND kcu.table_name = tc.table_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_schema = tc.constraint_schema
        AND ccu.constraint_name = tc.constraint_name
      WHERE tc.table_schema = c.table_schema
        AND tc.table_name = c.table_name
        AND kcu.column_name = c.column_name
        AND tc.constraint_type = 'FOREIGN KEY'
      LIMIT 1
    ) AS parent_table
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name IN (
      'branches', 'relationship_managers', 'borrowers', 'loans',
      'loan_payments', 'collateral', 'customer_contacts'
    )
  ORDER BY c.table_name, c.ordinal_position
`

/** `loan_payments` -> `Loan Payments`, `branch_id` -> `Branch ID`. */
function humanize(name: string): string {
  return name
    .split('_')
    .map((word) => (word === 'id' ? 'ID' : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

function describeColumn(column: ColumnCatalogRow): string {
  const key = `${column.table_name}.${column.column_name}`
  return (
    COLUMN_DESCRIPTIONS[key] ??
    `${column.column_name.replaceAll('_', ' ')} for ${column.table_name.replaceAll('_', ' ')}.`
  )
}

export async function seedLendingMetadata(
  appConnection: AppDatabaseHandle,
  metadataDb: Database,
): Promise<number> {
  const columns = await appConnection.sql<ColumnCatalogRow[]>`${appConnection.sql.unsafe(COLUMN_CATALOG_QUERY)}`
  if (columns.length === 0) {
    throw new Error('No lending tables found. Run database migrations before seeding metadata.')
  }

  const tableNames = Object.keys(TABLE_DESCRIPTIONS)

  await metadataDb.transaction(async (tx) => {
    const existingTables = await tx
      .select({ id: tableMetadata.id })
      .from(tableMetadata)
      .where(inArray(tableMetadata.name, tableNames))
    const existingIds = existingTables.map((table) => table.id)

    if (existingIds.length > 0) {
      await tx.delete(columnMetadata).where(inArray(columnMetadata.table_id, existingIds))
      await tx.delete(tableMetadata).where(inArray(tableMetadata.id, existingIds))
    }

    const insertedTables = await tx
      .insert(tableMetadata)
      .values(
        tableNames.map((name) => ({
          name,
          display_name: humanize(name),
          description: TABLE_DESCRIPTIONS[name]!,
          is_active: true,
          is_parent: PARENT_TABLES.has(name),
          is_parentId: 0,
        })),
      )
      .returning({ id: tableMetadata.id, name: tableMetadata.name })
    const tableIdByName = new Map(insertedTables.map((table) => [table.name, table.id]))

    await tx.insert(columnMetadata).values(
      columns.map((column) => {
        const tableId = tableIdByName.get(column.table_name)
        if (!tableId) throw new Error(`No metadata row created for ${column.table_name}`)

        return {
          name: column.column_name,
          display_name: humanize(column.column_name),
          column_data_type: column.column_data_type,
          is_nullable: column.is_nullable,
          default_value: column.default_value,
          character_maximum_length: column.character_maximum_length,
          numeric_precision: column.numeric_precision,
          numeric_scale: column.numeric_scale,
          is_primary_key: column.is_primary_key,
          is_foreign_key: column.is_foreign_key,
          is_unique: column.is_unique,
          is_indexed: column.is_indexed,
          parent_table: column.parent_table,
          table_id: tableId,
          description: describeColumn(column),
          is_active: true,
        }
      }),
    )
  })

  return columns.length
}