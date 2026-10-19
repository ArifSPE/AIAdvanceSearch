import { defineQueryFilter, filterInputType, queryPlanSchema, type MetadataTableWithColumns, type QueryFilterInput, type QueryPlan } from '@ais/shared'
import { addQueryFilters } from './query-filters'

export interface ApprovedRelationship {
  id: string
  childTable: string
  childColumn: string
  parentTable: string
  parentColumn: string
}

export function approvedRelationships(catalog: MetadataTableWithColumns[]): ApprovedRelationship[] {
  return catalog.flatMap((table) => table.columns.flatMap((column) => {
    const parent = column.is_foreign_key ? catalog.find((candidate) => candidate.name === column.parent_table) : undefined
    const keys = parent?.columns.filter((candidate) => candidate.is_primary_key) ?? []
    if (!parent || keys.length !== 1) return []
    const key = keys[0]!
    return [{ id: `${table.name}.${column.name}->${parent.name}.${key.name}`, childTable: table.name, childColumn: column.name, parentTable: parent.name, parentColumn: key.name }]
  }))
}

function quote(name: string): string { return `"${name.replaceAll('"', '""')}"` }
function reference(name: string): string { return name.split('.').map(quote).join('.') }

export function compileQueryPlan(input: unknown, catalog: MetadataTableWithColumns[], options?: {
  selectedColumns?: string[]
  filters?: QueryFilterInput[]
}) {
  const plan = queryPlanSchema.parse(input)
  if (new Set(plan.tables).size !== plan.tables.length) throw new Error('Plan tables must be unique')
  const tables = plan.tables.map((name) => {
    const table = catalog.find((candidate) => candidate.name === name)
    if (!table) throw new Error(`Unapproved table: ${name}`)
    return table
  })
  function column(qualified: string) {
    const [tableName, columnName] = qualified.split('.')
    const found = tables.find((table) => table.name === tableName)?.columns.find((entry) => entry.name === columnName)
    if (!found) throw new Error(`Unapproved column: ${qualified}`)
    return found
  }
  const outputColumns = plan.projections.map((projection) => {
    const metadata = column(projection.column)
    if (options?.selectedColumns && !options.selectedColumns.includes(projection.column)) throw new Error(`Unselected output column: ${projection.column}`)
    if (['sum', 'avg'].includes(projection.aggregate) && !['number', 'integer'].includes(filterInputType(metadata.column_data_type, metadata.allowed_values) ?? '')) throw new Error('SUM and AVG require numeric columns')
    if (['min', 'max'].includes(projection.aggregate) && !['number', 'integer', 'date', 'datetime', 'text'].includes(filterInputType(metadata.column_data_type, metadata.allowed_values) ?? '')) throw new Error('MIN and MAX require an ordered scalar column')
    return projection.column
  })
  if (options?.selectedColumns && (outputColumns.length !== options.selectedColumns.length || outputColumns.some((name, index) => name !== options.selectedColumns![index]))) throw new Error('Projections must match the reviewed output selection and order')
  if (new Set(outputColumns).size !== outputColumns.length) throw new Error('Duplicate output columns are not supported')
  const aggregated = plan.projections.some((projection) => projection.aggregate !== 'none')
  const unaggregated = plan.projections.filter((projection) => projection.aggregate === 'none').map((projection) => projection.column)
  for (const group of plan.groupBy) column(group)
  if (new Set(plan.groupBy).size !== plan.groupBy.length) throw new Error('Duplicate grouping columns')
  if (aggregated ? plan.groupBy.length !== unaggregated.length || unaggregated.some((name) => !plan.groupBy.includes(name)) : plan.groupBy.length !== 0) throw new Error('Grouping must exactly match the non-aggregate projections')
  for (const order of plan.orderBy) if (order.projection >= plan.projections.length) throw new Error('Invalid sort projection')
  const relationships = approvedRelationships(tables)
  const joined = new Set([plan.tables[0]!])
  let from = quote(plan.tables[0]!)
  for (const join of plan.joins) {
    const relation = relationships.find((candidate) => candidate.id === join.relationshipId)
    if (!relation) throw new Error(`Unapproved relationship: ${join.relationshipId}`)
    const childPresent = joined.has(relation.childTable)
    const parentPresent = joined.has(relation.parentTable)
    if (childPresent === parentPresent) throw new Error('Each join must connect exactly one new table')
    const nextTable = childPresent ? relation.parentTable : relation.childTable
    from += ` ${join.type === 'left' ? 'LEFT JOIN' : 'INNER JOIN'} ${quote(nextTable)} ON ${reference(`${relation.childTable}.${relation.childColumn}`)} = ${reference(`${relation.parentTable}.${relation.parentColumn}`)}`
    joined.add(nextTable)
  }
  if (joined.size !== tables.length) throw new Error('All plan tables must be connected by approved relationships')
  if (new Set(plan.filters.map((filter) => filter.id)).size !== plan.filters.length) throw new Error('Duplicate filter IDs')
  if (options?.filters) {
    if (options.filters.length !== plan.filters.length || options.filters.some((filter, index) => {
      const actual = plan.filters[index]
      return !actual || ['id', 'table', 'column', 'operator'].some((key) => actual[key as keyof QueryFilterInput] !== filter[key as keyof QueryFilterInput])
    })) throw new Error('Plan filters must match the reviewed filter list')
  }
  const filters = (options?.filters ?? plan.filters).map((filter) => {
    const metadata = column(`${filter.table}.${filter.column}`)
    const table = tables.find((candidate) => candidate.name === filter.table)!
    return defineQueryFilter(filter, metadata, table.display_name)
  })
  const aliases = plan.projections.map((projection) => {
    const [tableName, columnName] = projection.column.split('.') as [string, string]
    if (projection.aggregate !== 'none') return `${projection.aggregate}_${tableName}_${columnName}`
    return outputColumns.filter((name) => name.endsWith(`.${columnName}`)).length > 1 ? `${tableName}_${columnName}` : columnName
  })
  if (aliases.some((alias) => alias.length > 63) || new Set(aliases).size !== aliases.length) throw new Error('Output aliases must be unique and at most 63 characters')
  const projectionSql = plan.projections.map((projection, index) => `${projection.aggregate === 'none' ? reference(projection.column) : `${projection.aggregate.toUpperCase()}(${reference(projection.column)})`} AS ${quote(aliases[index]!)}`).join(', ')
  const groupBy = plan.groupBy.length ? ` GROUP BY ${plan.groupBy.map(reference).join(', ')}` : ''
  const orderBy = plan.orderBy.length ? ` ORDER BY ${plan.orderBy.map((order) => `${order.projection + 1} ${order.direction.toUpperCase()}`).join(', ')}` : ''
  const canonicalPlan: QueryPlan = { ...plan, filters: filters.map(({ id, table, column: name, operator, defaultValue }) => ({ id, table, column: name, operator, defaultValue })) }
  return { plan: canonicalPlan, sql: addQueryFilters(`SELECT ${projectionSql} FROM ${from}${groupBy}${orderBy}`, filters), filters, tables, outputNames: aliases }
}