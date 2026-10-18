import { defineQueryFilter, filterInputType, validateFilterValue } from '@ais/shared'
import { createDatabase, documents } from '@ais/db'
import { addQueryFilters, bindQueryFilters } from './query-filters'
import { describe, expect, it } from 'vitest'

const column = { name: 'balance', display_name: 'Balance', description: 'Outstanding amount in USD', column_data_type: 'numeric', character_maximum_length: 0, numeric_precision: 12, numeric_scale: 2 }
const input = { id: 'balance', table: 'loans', column: 'balance', operator: 'gte' as const, defaultValue: '500000' }

describe('metadata-based query filters', () => {
  it('derives labels, descriptions, and numeric controls from metadata', () => {
    expect(defineQueryFilter(input, column, 'Loans')).toMatchObject({ label: 'Loans: Balance', description: column.description, inputType: 'number', scale: 2 })
  })
  it('rejects incompatible operators, unsupported types, and invalid defaults', () => {
    expect(() => defineQueryFilter({ ...input, operator: 'contains' }, column, 'Loans')).toThrow('Invalid operator')
    expect(() => defineQueryFilter(input, { ...column, column_data_type: 'jsonb' }, 'Loans')).toThrow('not supported')
    expect(() => defineQueryFilter({ ...input, defaultValue: 'bad number' }, column, 'Loans')).toThrow('finite number')
  })
  it('enforces numeric scale and precision', () => {
    const filter = defineQueryFilter(input, column, 'Loans')
    expect(validateFilterValue(filter, '1.234')).toContain('scale')
    expect(validateFilterValue(filter, '10000000000')).toContain('precision')
  })
  it('uses metadata enum values for constrained selection', () => {
    const filter = defineQueryFilter({ ...input, operator: 'eq', defaultValue: 'active' }, { ...column, column_data_type: 'loan_status', allowed_values: ['active', 'closed'] }, 'Loans')
    expect(filter.inputType).toBe('enum')
    expect(validateFilterValue(filter, 'unknown')).toContain('must be one of')
    expect(validateFilterValue(filter, 'closed')).toBeNull()
  })
  it('validates booleans, real dates, UUIDs, text length, and integer ranges', () => {
    const base = defineQueryFilter(input, column, 'Loans')
    expect(validateFilterValue({ ...base, inputType: 'boolean', operator: 'eq' }, 'true')).toContain('true or false')
    expect(validateFilterValue({ ...base, inputType: 'date' }, '2026-02-30')).toContain('valid date')
    expect(validateFilterValue({ ...base, inputType: 'uuid' }, 'not-a-uuid')).toContain('UUID')
    expect(validateFilterValue({ ...base, inputType: 'text', maxLength: 3 }, 'long')).toContain('longer')
    expect(validateFilterValue({ ...base, inputType: 'integer', dataType: 'smallint' }, '32768')).toContain('range')
    expect(validateFilterValue({ ...base, inputType: 'integer', dataType: 'bigint' }, '9223372036854775807')).toBeNull()
    expect(filterInputType('timestamp with time zone')).toBe('datetime')
  })
})

describe('parameterized filter SQL', () => {
  const filter = defineQueryFilter({ ...input, column: 'outstanding_balance' }, column, 'Loans')

  it('inserts predicates with aliases before sorting and grouping', () => {
    const query = addQueryFilters('SELECT l.loan_number FROM loans AS l ORDER BY l.loan_number', [filter])
    expect(query).toContain('$1')
    expect(query).toContain('outstanding_balance')
    expect(query.indexOf('WHERE')).toBeLessThan(query.indexOf('ORDER BY'))
    expect(query).not.toContain('500000')
  })
  it('does not accept model-generated filters, placeholders, or CTEs in managed queries', () => {
    expect(() => addQueryFilters('SELECT loan_number FROM loans WHERE status = \'active\'', [])).toThrow('must not contain WHERE')
    expect(() => addQueryFilters('SELECT $1 FROM loans', [])).toThrow('placeholders')
    expect(() => addQueryFilters('WITH x AS (SELECT loan_number FROM loans) SELECT loan_number FROM x', [])).toThrow('single SELECT')
  })
  it('supports null checks without allocating a parameter slot', () => {
    const nullFilter = { ...filter, id: 'missing', column: 'next_payment_date', operator: 'isNull' as const, defaultValue: null }
    const query = addQueryFilters('SELECT loan_number FROM loans', [nullFilter, filter])
    expect(query).toContain('IS NULL')
    expect(query).toContain('$1')
    expect(query).not.toContain('$2')
    expect(() => bindQueryFilters(query, [nullFilter, filter])).not.toThrow()
  })
  it('binds values separately, including hostile text and quoted dollar signs', async () => {
    const textFilter = defineQueryFilter({ id: 'status', table: 'loans', column: 'status', operator: 'eq', defaultValue: 'active' }, { ...column, column_data_type: 'text' }, 'Loans')
    const query = addQueryFilters('SELECT loan_number FROM loans', [textFilter])
    const connection = createDatabase('postgresql://unused:unused@localhost:1/unused')
    try {
      const hostile = "active' OR 1=1 -- $1"
      const bound = connection.db.select({ result: bindQueryFilters(query, [textFilter], { status: hostile }) }).from(documents).toSQL()
      expect(bound.params).toEqual([hostile])
      expect(bound.sql).not.toContain(hostile)
      expect(() => bindQueryFilters(query, [textFilter], { unknown: 'x' })).toThrow('Unknown filter')
    } finally { await connection.close() }
  })
  it('rejects missing, duplicate, and extra placeholders, and ignores quoted placeholders', () => {
    expect(() => bindQueryFilters('SELECT loan_number FROM loans', [filter])).toThrow('does not match')
    expect(() => bindQueryFilters('SELECT $1, $1 FROM loans', [filter])).toThrow('does not match')
    expect(() => bindQueryFilters('SELECT $2 FROM loans', [filter])).toThrow('reference')
    expect(() => bindQueryFilters("SELECT '$1' AS literal", [])).not.toThrow()
    expect(() => bindQueryFilters('SELECT $1 FROM loans', [filter], { balance: 'bad' })).toThrow('finite number')
  })
})