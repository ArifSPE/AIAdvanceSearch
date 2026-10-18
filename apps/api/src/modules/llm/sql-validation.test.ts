import { describe, expect, it } from 'vitest'
import { assertReadOnlySql } from './sql-validation'

describe('assertReadOnlySql', () => {
  it('accepts SELECT and read-only CTE queries', () => {
    expect(() => assertReadOnlySql('SELECT id FROM borrowers')).not.toThrow()
    expect(() =>
      assertReadOnlySql('WITH active AS (SELECT id FROM loans) SELECT id FROM active'),
    ).not.toThrow()
  })

  it('rejects data-changing CTEs', () => {
    expect(() =>
      assertReadOnlySql('WITH removed AS (DELETE FROM users RETURNING id) SELECT id FROM removed'),
    ).toThrow('read-only SELECT')
  })

  it('rejects multiple statements and row-locking SELECTs', () => {
    expect(() => assertReadOnlySql('SELECT 1; DELETE FROM users')).toThrow()
    expect(() => assertReadOnlySql('SELECT id FROM loans FOR UPDATE')).toThrow()
  })

  it('rejects tables outside the selected schema', () => {
    expect(() =>
      assertReadOnlySql('SELECT email FROM users', [{ name: 'loans', columns: ['id'] }]),
    ).toThrow(
      'unselected table: users',
    )
    expect(() =>
      assertReadOnlySql('SELECT users.email FROM loans', [{ name: 'loans', columns: ['id'] }]),
    ).toThrow('unselected column: users.email')
  })

  it('allows CTEs over selected tables', () => {
    expect(() =>
      assertReadOnlySql(
        'WITH active AS (SELECT loan_number FROM loans) SELECT loan_number FROM active',
        [{ name: 'loans', columns: ['loan_number'] }],
      ),
    ).not.toThrow()
  })

  it('allows aliases of CTEs to reference selected columns', () => {
    expect(() =>
      assertReadOnlySql(
        'WITH active AS (SELECT loan_number FROM loans) SELECT current_loans.loan_number FROM active AS current_loans',
        [{ name: 'loans', columns: ['loan_number'] }],
      ),
    ).not.toThrow()
  })

  it('allows allowlisted aggregate and scalar functions', () => {
    expect(() =>
      assertReadOnlySql('SELECT lower(status), sum(outstanding_balance) FROM loans GROUP BY status'),
    ).not.toThrow()
    expect(() => assertReadOnlySql("SELECT date_trunc('month', maturity_date) FROM loans")).not.toThrow()
  })

  it('rejects functions outside the allowlist', () => {
    expect(() => assertReadOnlySql("SELECT pg_read_file('/etc/passwd') FROM loans")).toThrow(
      'Function is not allowed in generated queries: pg_read_file',
    )
    expect(() => assertReadOnlySql('SELECT pg_sleep(4) FROM loans')).toThrow('pg_sleep')
    expect(() =>
      assertReadOnlySql("SELECT set_config('statement_timeout', '0', false) FROM loans"),
    ).toThrow('set_config')
  })

  it('rejects allowlisted names under a non-catalog schema', () => {
    expect(() => assertReadOnlySql('SELECT evil.count(id) FROM loans')).toThrow('not allowed')
  })

  it('allows count(*) but still rejects wildcard column selection', () => {
    const loans = [{ name: 'loans', columns: ['status'] }]
    expect(() => assertReadOnlySql('SELECT status, count(*) FROM loans GROUP BY status', loans)).not.toThrow()
    expect(() => assertReadOnlySql('SELECT * FROM loans', loans)).toThrow('Wildcard')
    expect(() => assertReadOnlySql('SELECT loans.* FROM loans', loans)).toThrow('Wildcard')
    expect(() => assertReadOnlySql('SELECT sum(*) FROM loans', loans)).toThrow('Wildcard')
  })

  it('rejects duplicate output column names but allows aliased ones', () => {
    const tables = [
      { name: 'loans', columns: ['id', 'borrower_id'] },
      { name: 'borrowers', columns: ['id'] },
    ]
    const join = 'FROM loans JOIN borrowers ON loans.borrower_id = borrowers.id'
    expect(() => assertReadOnlySql(`SELECT loans.id, borrowers.id ${join}`, tables)).toThrow(
      'Output column names must be unique; alias duplicate column: id',
    )
    expect(() =>
      assertReadOnlySql(`SELECT loans.id AS loans_id, borrowers.id AS borrowers_id ${join}`, tables),
    ).not.toThrow()
  })

  it('rejects disallowed functions nested in subqueries, CTEs, and filters', () => {
    expect(() =>
      assertReadOnlySql("WITH x AS (SELECT pg_read_file('a') AS f FROM loans) SELECT f FROM x"),
    ).toThrow('pg_read_file')
    expect(() =>
      assertReadOnlySql("SELECT id FROM loans WHERE id IN (SELECT lo_import('a') FROM loans)"),
    ).toThrow('lo_import')
  })
})