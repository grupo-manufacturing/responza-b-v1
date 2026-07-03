import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'

export type CatalogueChunkRecord = {
  id: string
  organization_id: string
  file_id: string
  chunk_index: number
  filename: string
  text: string
  created_at: string
}

const CHUNK_COLUMNS =
  'id, organization_id, file_id, chunk_index, filename, text, created_at'

function normalizeChunkRecord(row: Record<string, unknown>): CatalogueChunkRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    file_id: row.file_id as string,
    chunk_index: row.chunk_index as number,
    filename: row.filename as string,
    text: row.text as string,
    created_at: row.created_at as string,
  }
}

export async function countChunksForOrganization(organizationId: string): Promise<number> {
  const client = getSupabaseAdminClient()
  const { count, error } = await client
    .from('business_catalogue_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count catalogue chunks')
  }

  return count ?? 0
}

export async function listChunksForOrganization(
  organizationId: string,
): Promise<CatalogueChunkRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('business_catalogue_chunks')
    .select(CHUNK_COLUMNS)
    .eq('organization_id', organizationId)
    .order('file_id', { ascending: true })
    .order('chunk_index', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load catalogue chunks')
  }

  return (data ?? []).map((row) => normalizeChunkRecord(row as Record<string, unknown>))
}

export async function deleteChunksForFile(
  organizationId: string,
  fileId: string,
): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('business_catalogue_chunks')
    .delete()
    .eq('organization_id', organizationId)
    .eq('file_id', fileId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete catalogue chunks')
  }
}

export async function replaceChunksForFile(input: {
  organization_id: string
  file_id: string
  filename: string
  chunks: string[]
}): Promise<void> {
  await deleteChunksForFile(input.organization_id, input.file_id)

  if (input.chunks.length === 0) {
    return
  }

  const rows = input.chunks.map((text, chunkIndex) => ({
    organization_id: input.organization_id,
    file_id: input.file_id,
    chunk_index: chunkIndex,
    filename: input.filename,
    text,
  }))

  const client = getSupabaseAdminClient()
  const { error } = await client.from('business_catalogue_chunks').insert(rows)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to save catalogue chunks')
  }
}
