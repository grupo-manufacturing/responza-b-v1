import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { KnowledgeSourceType } from './knowledge.constants.js'

export type KnowledgeChunkRecord = {
  id: string
  organization_id: string
  source_type: KnowledgeSourceType
  source_key: string
  chunk_index: number
  content: string
  metadata: Record<string, unknown>
}

export type KnowledgeChunkMatch = {
  id: string
  source_type: KnowledgeSourceType
  source_key: string
  content: string
  metadata: Record<string, unknown>
  similarity: number
}

export type KnowledgeIndexStateRecord = {
  organization_id: string
  last_indexed_at: string | null
  index_version: number
  chunk_count: number
  last_error: string | null
  updated_at: string
}

type KnowledgeChunkInsert = {
  organization_id: string
  source_type: KnowledgeSourceType
  source_key: string
  chunk_index: number
  content: string
  embedding: number[]
  metadata: Record<string, unknown>
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return {}
}

export async function deleteChunksForSource(input: {
  organizationId: string
  sourceType: KnowledgeSourceType
  sourceKey: string
}): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('organization_knowledge_chunks')
    .delete()
    .eq('organization_id', input.organizationId)
    .eq('source_type', input.sourceType)
    .eq('source_key', input.sourceKey)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete knowledge chunks')
  }
}

export async function deleteChunksBySourceType(input: {
  organizationId: string
  sourceType: KnowledgeSourceType
}): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('organization_knowledge_chunks')
    .delete()
    .eq('organization_id', input.organizationId)
    .eq('source_type', input.sourceType)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete knowledge chunks')
  }
}

export async function listOrganizationIdsWithWebsiteUrl(): Promise<string[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_business_profiles')
    .select('organization_id, website_url')
    .not('website_url', 'is', null)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list website profiles')
  }

  return (data ?? [])
    .filter((row) => typeof row.website_url === 'string' && row.website_url.trim().length > 0)
    .map((row) => row.organization_id as string)
}

export async function listOrganizationIdsWithConnectedInstagram(): Promise<string[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select('organization_id')
    .eq('platform', 'instagram')
    .eq('status', 'connected')

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list Instagram integrations')
  }

  return (data ?? []).map((row) => row.organization_id as string)
}

export async function insertKnowledgeChunks(chunks: KnowledgeChunkInsert[]): Promise<void> {
  if (chunks.length === 0) {
    return
  }

  const client = getSupabaseAdminClient()
  const { error } = await client.from('organization_knowledge_chunks').insert(
    chunks.map((chunk) => ({
      organization_id: chunk.organization_id,
      source_type: chunk.source_type,
      source_key: chunk.source_key,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: chunk.metadata,
      updated_at: new Date().toISOString(),
    })),
  )

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to save knowledge chunks')
  }
}

export async function upsertKnowledgeIndexState(input: {
  organizationId: string
  chunkCount: number
  lastError?: string | null
}): Promise<void> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { error } = await client.from('organization_knowledge_index_state').upsert(
    {
      organization_id: input.organizationId,
      last_indexed_at: input.lastError === undefined || input.lastError === null ? now : null,
      chunk_count: input.chunkCount,
      last_error: input.lastError ?? null,
      updated_at: now,
    },
    { onConflict: 'organization_id' },
  )

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update knowledge index state')
  }
}

export async function countKnowledgeChunks(organizationId: string): Promise<number> {
  const client = getSupabaseAdminClient()
  const { count, error } = await client
    .from('organization_knowledge_chunks')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count knowledge chunks')
  }

  return count ?? 0
}

export async function matchKnowledgeChunks(input: {
  organizationId: string
  embedding: number[]
  topK: number
}): Promise<KnowledgeChunkMatch[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.rpc('match_knowledge_chunks', {
    query_embedding: input.embedding,
    match_organization_id: input.organizationId,
    match_count: input.topK,
  })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve knowledge chunks')
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    source_type: row.source_type as KnowledgeSourceType,
    source_key: row.source_key as string,
    content: row.content as string,
    metadata: normalizeMetadata(row.metadata),
    similarity: Number(row.similarity ?? 0),
  }))
}

export async function getKnowledgeIndexState(
  organizationId: string,
): Promise<KnowledgeIndexStateRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_knowledge_index_state')
    .select(
      'organization_id, last_indexed_at, index_version, chunk_count, last_error, updated_at',
    )
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load knowledge index state')
  }

  if (data === null) {
    return null
  }

  return data as KnowledgeIndexStateRecord
}
