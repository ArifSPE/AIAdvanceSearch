import { sql } from '@ais/db'
import { validateFilterValue, type FilterValues, type QueryFilter } from '@ais/shared'
import { parse, toSql } from 'pgsql-ast-parser'

type AstNode = Record<string, unknown>

export class InvalidFilterValuesError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidFilterValuesError' }
}

function visit(value: unknown, callback: (node: AstNode) => void) {
  if (Array.isArray(value)) { for (const item of value) visit(item, callback); return }
  if (!value || typeof value !== 'object') return
  callback(value as AstNode)
  for (const child of Object.values(value)) visit(child, callback)
}

export function addQueryFilters(baseSql: string, filters: QueryFilter[]): string {
  const statements = parse(baseSql)
  const statement = statements[0]
  if (statements.length !== 1 || statement?.type !== 'select') throw new Error('Parameterized queries require a single SELECT without CTEs or UNION')
  if (statement.where) throw new Error('The base query must not contain WHERE; filters are applied by the server')
  let hasParameter = false
  visit(statement, (node) => { if (node.type === 'parameter') hasParameter = true })
  if (hasParameter) throw new Error('The base query must not contain parameter placeholders')
  let parameter = 0
  const operators = { eq: '=', ne: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', contains: 'ILIKE', startsWith: 'ILIKE', isNull: 'IS NULL', isNotNull: 'IS NOT NULL' }
  for (const filter of filters) {
    const source = statement.from?.find((table) => table.type === 'table' && table.name.name === filter.table)
    if (!source || source.type !== 'table') throw new Error(`Filter table must appear directly in FROM/JOIN: ${filter.table}`)
    const reference = toSql.expr({ type: 'ref', table: { name: source.name.alias ?? source.name.name }, name: filter.column })
    const operand = filter.operator === 'isNull' || filter.operator === 'isNotNull' ? '' : ` $${++parameter}`
    const [predicate] = parse(`SELECT 1 WHERE ${reference} ${operators[filter.operator]}${operand}`)
    if (predicate?.type !== 'select' || !predicate.where) throw new Error('Could not build filter predicate')
    statement.where = statement.where ? { type: 'binary', op: 'AND', left: statement.where, right: predicate.where } : predicate.where
  }
  return toSql.statement(statement)
}

export function withFilterDefaults(filters: QueryFilter[], overrides: FilterValues = {}): QueryFilter[] {
  const ids = new Set(filters.map((filter) => filter.id))
  if (ids.size !== filters.length) throw new InvalidFilterValuesError('Filter IDs must be unique')
  for (const id of Object.keys(overrides)) if (!ids.has(id)) throw new InvalidFilterValuesError(`Unknown filter: ${id}`)
  return filters.map((filter) => {
    const value = Object.hasOwn(overrides, filter.id) ? overrides[filter.id]! : filter.defaultValue
    const error = validateFilterValue(filter, value)
    if (error) throw new InvalidFilterValuesError(error)
    return { ...filter, defaultValue: value }
  })
}

export function bindQueryFilters(querySql: string, filters: QueryFilter[], overrides: FilterValues = {}) {
  const parameters: Array<string | number | boolean> = []
  for (const filter of withFilterDefaults(filters, overrides)) {
    const value = filter.defaultValue
    if (filter.operator === 'isNull' || filter.operator === 'isNotNull') continue
    if (value === null) throw new InvalidFilterValuesError(`${filter.label} requires a value`)
    const escaped = String(value).replace(/[\\%_]/g, '\\$&')
    parameters.push(filter.operator === 'contains' ? `%${escaped}%` : filter.operator === 'startsWith' ? `${escaped}%` : value)
  }
  const locations: Array<{ start: number; end: number; index: number }> = []
  visit(parse(querySql, { locationTracking: true }), (node) => {
    if (node.type !== 'parameter') return
    const location = node._location as { start: number; end: number } | undefined
    const index = typeof node.name === 'string' && /^\$[1-9]\d*$/.test(node.name) ? Number(node.name.slice(1)) - 1 : -1
    if (!location || index < 0 || index >= parameters.length) throw new InvalidFilterValuesError('Invalid SQL parameter reference')
    locations.push({ ...location, index })
  })
  if (locations.length !== parameters.length || new Set(locations.map((location) => location.index)).size !== parameters.length) {
    throw new InvalidFilterValuesError('The SQL parameter list does not match its filters')
  }
  const query = sql.empty()
  let cursor = 0
  for (const location of locations.sort((left, right) => left.start - right.start)) {
    query.append(sql.raw(querySql.slice(cursor, location.start)))
    query.append(sql`${parameters[location.index]}`)
    cursor = location.end
  }
  query.append(sql.raw(querySql.slice(cursor)))
  return query
}