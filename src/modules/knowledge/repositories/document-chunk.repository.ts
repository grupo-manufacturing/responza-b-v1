import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { DocumentChunkInsert, DocumentChunkRecord } from '../jobs/knowledge-job.types.js'

const COLUMNS = 'id, organization_id, source_type, source_ref, content, embedding, created_at'

function normalizeRecord(row: Record<string, unknown>): DocumentChunkRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    source_type: row.source_type as string,
    source_ref: (row.source_ref as string | null) ?? null,
    content: row.content as string,
    embedding: Array.isArray(row.embedding) ? (row.embedding as number[]) : null,
    created_at: row.created_at as string,
  }
}

export async function deleteDocumentChunksByOrganizationId(organizationId: string): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('organization_document_chunks')
    .delete()
    .eq('organization_id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to clear document chunks')
  }
}

export async function insertDocumentChunks(
  organizationId: string,
  chunks: DocumentChunkInsert[],
): Promise<DocumentChunkRecord[]> {
  if (chunks.length === 0) {
    return []
  }

  const client = getSupabaseAdminClient()
  const rows = chunks.map((chunk) => ({
    organization_id: organizationId,
    source_type: chunk.source_type,
    source_ref: chunk.source_ref,
    content: chunk.content,
    embedding: chunk.embedding,
  }))

  const { data, error } = await client
    .from('organization_document_chunks')
    .insert(rows)
    .select(COLUMNS)

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to save document chunks')
  }

  return data.map((row) => normalizeRecord(row as Record<string, unknown>))
}

export async function countDocumentChunksByOrganizationId(organizationId: string): Promise<number> {
  const client = getSupabaseAdminClient()
  const { count, error } = await client
    .from('organization_document_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count document chunks')
  }

  return count ?? 0
}

export async function countDocumentChunksBySourceType(
  organizationId: string,
): Promise<Array<{ source_type: string; chunk_count: number }>> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_document_chunks')
    .select('source_type')
    .eq('organization_id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load document chunk counts')
  }

  const counts = new Map<string, number>()

  for (const row of data ?? []) {
    const sourceType = (row as { source_type: string }).source_type
    counts.set(sourceType, (counts.get(sourceType) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([source_type, chunk_count]) => ({ source_type, chunk_count }))
    .sort((left, right) => left.source_type.localeCompare(right.source_type))
}
