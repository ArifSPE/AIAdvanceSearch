import { parse, type SelectStatement, type Statement } from 'pgsql-ast-parser'

type AstRecord = Record<string, unknown> & { type?: unknown }
export interface AllowedSqlTable {
  name: string
  columns: readonly string[]
}

// Anything not listed (pg_read_file, dblink, lo_*, set_config, ...) is rejected.
const allowedFunctions = new Set([
  'count', 'sum', 'avg', 'min', 'max',
  'coalesce', 'nullif', 'greatest', 'least',
  'abs', 'round', 'ceil', 'ceiling', 'floor',
  'lower', 'upper', 'length', 'trim', 'ltrim', 'rtrim', 'replace', 'concat',
  'date_trunc', 'date_part', 'age', 'now', 'to_char',
  'row_number', 'rank', 'dense_rank',
])

function assertAllowedFunctions(statement: Statement): void {
  walkAst(statement, (node) => {
    if (node.type !== 'call') return
    const fn = node.function as { name?: unknown; schema?: unknown } | undefined
    const name = typeof fn?.name === 'string' ? fn.name.toLowerCase() : undefined
    if (!name || !allowedFunctions.has(name) || (fn?.schema && fn.schema !== 'pg_catalog')) {
      throw new Error(`Function is not allowed in generated queries: ${name ?? 'unknown'}`)
    }
  })
}

function isReadOnlySelect(statement: Statement | SelectStatement): boolean {
  switch (statement.type) {
    case 'select':
      return !statement.for
    case 'union':
    case 'union all':
      return isReadOnlySelect(statement.left) && isReadOnlySelect(statement.right)
    case 'with':
      return (
        statement.bind.every((binding) => isReadOnlySelect(binding.statement)) &&
        isReadOnlySelect(statement.in)
      )
    case 'with recursive':
      return isReadOnlySelect(statement.bind) && isReadOnlySelect(statement.in)
    default:
      return false
  }
}

function walkAst(value: unknown, visit: (node: AstRecord, parentKey?: string) => void, parentKey?: string): void {
  if (Array.isArray(value)) {
    for (const child of value) walkAst(child, visit, parentKey)
    return
  }
  if (!value || typeof value !== 'object') return

  const node = value as AstRecord
  visit(node, parentKey)
  for (const [key, child] of Object.entries(node)) walkAst(child, visit, key)
}

function readName(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

function outputSelect(statement: Statement | SelectStatement): SelectStatement | undefined {
  switch (statement.type) {
    case 'select':
      return statement
    case 'union':
    case 'union all':
      return outputSelect(statement.left)
    case 'with':
    case 'with recursive':
      return outputSelect(statement.in)
    default:
      return undefined
  }
}

// Result rows are JSON objects, so two output columns with one name would overwrite each other.
function assertUniqueOutputNames(statement: Statement): void {
  const select = outputSelect(statement)
  if (!select || select.type !== 'select') return

  const seen = new Set<string>()
  for (const column of select.columns ?? []) {
    const expr = column.expr as AstRecord
    const name = readName(column.alias) ?? (expr.type === 'ref' ? readName(expr.name) : undefined)
    if (!name || name === '*') continue
    if (seen.has(name)) {
      throw new Error(`Output column names must be unique; alias duplicate column: ${name}`)
    }
    seen.add(name)
  }
}

export function assertReadOnlySql(sql: string, allowedTables?: readonly AllowedSqlTable[]): void {
  const statements = parse(sql)
  if (statements.length !== 1 || !isReadOnlySelect(statements[0]!)) {
    throw new Error('The model must return exactly one read-only SELECT statement')
  }

  assertAllowedFunctions(statements[0]!)
  assertUniqueOutputNames(statements[0]!)

  if (!allowedTables) return

  const cteNames = new Set<string>()
  walkAst(statements[0], (node) => {
    if (node.type === 'with' && Array.isArray(node.bind)) {
      for (const binding of node.bind) {
        if (binding && typeof binding === 'object' && 'alias' in binding) {
          const alias = readName((binding as { alias?: unknown }).alias)
          if (alias) cteNames.add(alias)
        }
      }
    }
    if (node.type === 'with recursive') {
      const alias = readName(node.alias)
      if (alias) cteNames.add(alias)
    }
  })

  const allowed = new Map(allowedTables.map((table) => [table.name, new Set(table.columns)]))
  const aliases = new Map<string, string>()
  walkAst(statements[0], (node) => {
    if (node.type !== 'table') return
    const name = readName(node.name)
    if (!name) return
    const schema = node.name && typeof node.name === 'object' && 'schema' in node.name
      ? (node.name as { schema?: unknown }).schema
      : undefined
    if (schema && schema !== 'public') {
      throw new Error(`Only public schema tables are allowed, received ${String(schema)}`)
    }
    const alias = node.name && typeof node.name === 'object' && 'alias' in node.name
      ? readName((node.name as { alias?: unknown }).alias)
      : undefined
    if (cteNames.has(name)) {
      if (alias) cteNames.add(alias)
      return
    }
    if (!allowed.has(name)) throw new Error(`Query references an unselected table: ${name}`)

    const tableName = name
    if (tableName && alias) aliases.set(alias, tableName)
  })

  const countStarArgs = new Set<unknown>()
  walkAst(statements[0], (node) => {
    const fn = node.function as { name?: unknown; schema?: unknown } | undefined
    if (node.type !== 'call' || fn?.name !== 'count' || fn.schema || !Array.isArray(node.args)) return
    for (const arg of node.args) {
      if (arg && typeof arg === 'object' && (arg as AstRecord).name === '*' && !(arg as AstRecord).table) {
        countStarArgs.add(arg)
      }
    }
  })

  walkAst(statements[0], (node, parentKey) => {
    if (parentKey === 'from' && node.type === 'call') {
      throw new Error('Table-valued functions are not allowed in generated queries')
    }
    if (node.type === 'ref') {
      if (node.name === '*') {
        if (countStarArgs.has(node)) return
        throw new Error('Wildcard column selection is not allowed in generated queries')
      }

      if (typeof node.name !== 'string') return
      const qualifier = readName(node.table)
      if (qualifier && cteNames.has(qualifier)) {
        if (![...allowed.values()].some((columns) => columns.has(node.name as string))) {
          throw new Error(`Query references an unselected column: ${qualifier}.${node.name}`)
        }
        return
      }

      const tableName = qualifier ? aliases.get(qualifier) ?? qualifier : undefined
      const columnIsAllowed = tableName
        ? allowed.get(tableName)?.has(node.name)
        : [...allowed.values()].some((columns) => columns.has(node.name as string))
      if (!columnIsAllowed) {
        throw new Error(`Query references an unselected column: ${qualifier ? `${qualifier}.` : ''}${node.name}`)
      }
    }
  })
}