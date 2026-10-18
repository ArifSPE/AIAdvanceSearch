import { z } from 'zod'

export const metadataColumnSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  display_name: z.string(),
  column_data_type: z.string(),
  allowed_values: z.array(z.string()).default([]),
  is_nullable: z.boolean(),
  default_value: z.string(),
  character_maximum_length: z.number().int(),
  numeric_precision: z.number().int(),
  numeric_scale: z.number().int(),
  is_primary_key: z.boolean(),
  is_foreign_key: z.boolean(),
  is_unique: z.boolean(),
  is_indexed: z.boolean(),
  parent_table: z.string().nullable(),
  table_id: z.uuid(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  description: z.string(),
  is_active: z.boolean(),
})

export const metadataTableSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  display_name: z.string(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  description: z.string(),
  is_active: z.boolean(),
  is_parent: z.boolean(),
  is_parentId: z.number().int(),
})

export const metadataTableWithColumnsSchema = metadataTableSchema.extend({
  columns: z.array(metadataColumnSchema),
})

export const metadataSchemaResponseSchema = z.object({
  tables: z.array(metadataTableWithColumnsSchema),
})

export type MetadataColumn = z.infer<typeof metadataColumnSchema>
export type MetadataTable = z.infer<typeof metadataTableSchema>
export type MetadataTableWithColumns = z.infer<typeof metadataTableWithColumnsSchema>
export type MetadataSchemaResponse = z.infer<typeof metadataSchemaResponseSchema>