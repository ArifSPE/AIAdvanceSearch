import { z } from 'zod'
import type { MetadataColumn } from './metadata'

export const filterValueSchema = z.union([z.string().max(4000), z.number().finite(), z.boolean(), z.null()])
export const filterOperatorSchema = z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'isNull', 'isNotNull'])
export const queryFilterInputSchema = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),
  table: z.string().trim().min(1).max(63),
  column: z.string().trim().min(1).max(63),
  operator: filterOperatorSchema,
  defaultValue: filterValueSchema,
})
export const queryFilterSchema = queryFilterInputSchema.extend({
  label: z.string().max(200),
  description: z.string().max(4000),
  dataType: z.string().max(128),
  inputType: z.enum(['text', 'number', 'integer', 'date', 'datetime', 'boolean', 'uuid', 'enum']),
  choices: z.array(z.string()).default([]),
  maxLength: z.number().int().nonnegative(),
  precision: z.number().int().nonnegative(),
  scale: z.number().int().nonnegative(),
})
export const filterValuesSchema = z.record(z.string(), filterValueSchema).optional()
export type QueryFilterInput = z.infer<typeof queryFilterInputSchema>
export type QueryFilter = z.infer<typeof queryFilterSchema>
export type FilterValue = z.infer<typeof filterValueSchema>
export type FilterValues = Record<string, FilterValue>

export function filterInputType(dataType: string, allowedValues: readonly string[] = []): QueryFilter['inputType'] | null {
  if (allowedValues.length > 0) return 'enum'
  const type = dataType.toLowerCase()
  if (['smallint', 'integer', 'bigint', 'int2', 'int4', 'int8'].includes(type)) return 'integer'
  if (/^(numeric|decimal|real|double precision|float4|float8)(\b|\()/.test(type)) return 'number'
  if (type === 'date') return 'date'
  if (type.startsWith('timestamp') || type === 'timestamptz') return 'datetime'
  if (['boolean', 'bool'].includes(type)) return 'boolean'
  if (type === 'uuid') return 'uuid'
  if (/^(text|character|varchar|char|name)(\b|\()/.test(type)) return 'text'
  return null
}

export function filterOperators(type: QueryFilter['inputType']): QueryFilterInput['operator'][] {
  return type === 'text' ? ['eq', 'ne', 'contains', 'startsWith', 'isNull', 'isNotNull']
    : type === 'boolean' || type === 'uuid' || type === 'enum' ? ['eq', 'ne', 'isNull', 'isNotNull']
    : ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'isNull', 'isNotNull']
}

export function validateFilterValue(filter: QueryFilter, value: FilterValue): string | null {
  if (filter.operator === 'isNull' || filter.operator === 'isNotNull') return null
  if (value === null || value === '') return `${filter.label} requires a value`
  const text = String(value)
  if (filter.inputType === 'enum') return typeof value === 'string' && filter.choices.includes(value) ? null : `${filter.label} must be one of: ${filter.choices.join(', ')}`
  if (filter.inputType === 'boolean') return typeof value === 'boolean' ? null : `${filter.label} must be true or false`
  if (filter.inputType === 'uuid') return z.uuid().safeParse(value).success ? null : `${filter.label} must be a UUID`
  if (filter.inputType === 'date') return z.iso.date().safeParse(value).success ? null : `${filter.label} must be a valid date`
  if (filter.inputType === 'datetime') return z.iso.datetime({ offset: true }).safeParse(value).success ? null : `${filter.label} must include a valid date, time, and timezone`
  if (filter.inputType === 'integer') {
    if (!/^-?\d+$/.test(text)) return `${filter.label} must be a whole number`
    const number = BigInt(text)
    const type = filter.dataType.toLowerCase()
    const bits = ['smallint', 'int2'].includes(type) ? 16n : ['integer', 'int4'].includes(type) ? 32n : 64n
    if (number < -(2n ** (bits - 1n)) || number > 2n ** (bits - 1n) - 1n) return `${filter.label} is outside the ${type} range`
    return null
  }
  if (filter.inputType === 'number') {
    if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text))) return `${filter.label} must be a finite number`
    if (/^(numeric|decimal)/i.test(filter.dataType) && filter.precision > 0) {
      const [whole = '', fraction = ''] = text.replace(/^-/, '').split('.')
      if (fraction.length > filter.scale || whole.replace(/^0+/, '').length > filter.precision - filter.scale) return `${filter.label} exceeds its numeric precision or scale`
    }
    return null
  }
  if (typeof value !== 'string') return `${filter.label} must be text`
  if (filter.maxLength > 0 && Array.from(value).length > filter.maxLength) return `${filter.label} is longer than ${filter.maxLength} characters`
  return null
}

export function defineQueryFilter(input: QueryFilterInput, column: Pick<MetadataColumn, 'name' | 'display_name' | 'description' | 'column_data_type' | 'character_maximum_length' | 'numeric_precision' | 'numeric_scale'> & { allowed_values?: string[] }, tableLabel: string, validateDefault = true): QueryFilter {
  const inputType = filterInputType(column.column_data_type, column.allowed_values)
  if (!inputType) throw new Error(`Filters are not supported for ${column.column_data_type}`)
  if (!filterOperators(inputType).includes(input.operator)) throw new Error(`Invalid operator for ${column.column_data_type}`)
  const filter = queryFilterSchema.parse({ ...input, label: `${tableLabel}: ${column.display_name || column.name}`.slice(0, 200), description: column.description.slice(0, 500), dataType: column.column_data_type,
    inputType, choices: column.allowed_values ?? [], maxLength: Math.max(0, column.character_maximum_length), precision: Math.max(0, column.numeric_precision), scale: Math.max(0, column.numeric_scale) })
  const error = validateFilterValue(filter, filter.defaultValue)
  if (validateDefault && error) throw new Error(error)
  return filter
}