import type { Database } from '@ais/db'
import type { CreateDocumentInput, Document, ListDocumentsQuery, Paginated } from '@ais/shared'
import { DocumentsRepository } from './documents.repository'

type DocumentRow = {
  id: string
  title: string
  url: string | null
  source: string
  status: 'pending' | 'indexed' | 'failed'
  createdAt: Date
}

function toDto(row: DocumentRow): Document {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

export class DocumentsService {
  private readonly repository: DocumentsRepository

  constructor(db: Database) {
    this.repository = new DocumentsRepository(db)
  }

  async list(query: ListDocumentsQuery): Promise<Paginated<Document>> {
    const { rows, total } = await this.repository.list(query)
    return { items: rows.map(toDto), total, limit: query.limit, offset: query.offset }
  }

  async findById(id: string): Promise<Document | null> {
    const row = await this.repository.findById(id)
    return row ? toDto(row) : null
  }

  /**
   * Persists the document as `pending`. Chunking + embedding (document_chunks)
   * is left to an indexing worker.
   */
  async create(input: CreateDocumentInput): Promise<Document> {
    const row = await this.repository.create(input)
    return toDto(row)
  }

  async remove(id: string): Promise<boolean> {
    return this.repository.remove(id)
  }
}
