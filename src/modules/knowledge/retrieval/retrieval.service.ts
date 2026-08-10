import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { embedTexts } from '../indexing/embeddings.js'

export type RetrievedChunk = {
  id: string
  content: string
  source_type: string
  source_ref: string | null
  distance: number
}

export function getChunkSimilarity(distance: number): number {
  return Math.max(0, 1 - distance)
}

type MatchRow = {
  id: string
  source_type: string
  source_ref: string | null
  content: string
  distance: number
}

export async function retrieveRelevantChunks(
  organizationId: string,
  question: string,
): Promise<RetrievedChunk[]> {
  const env = loadEnv()
  const queryEmbedding = (await embedTexts([question]))[0]

  if (queryEmbedding === undefined) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Failed to embed question.')
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client.rpc('match_organization_document_chunks', {
    query_embedding: queryEmbedding,
    match_organization_id: organizationId,
    match_count: env.KNOWLEDGE_RETRIEVAL_TOP_K,
  })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve knowledge chunks.')
  }

  const rows = (data ?? []) as MatchRow[]
  const chunks: RetrievedChunk[] = []

  for (const row of rows) {
    const distance = Number(row.distance)
    if (distance > env.KNOWLEDGE_SIMILARITY_THRESHOLD) {
      continue
    }

    chunks.push({
      id: row.id,
      content: row.content,
      source_type: row.source_type,
      source_ref: row.source_ref,
      distance,
    })
  }

  return chunks
}
