import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import { logger } from '../../../shared/logger.js'
import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { embedTexts } from '../indexing/embeddings.js'
import { findDocumentChunksForRetrieval } from '../repositories/document-chunk.repository.js'
import { cosineDistance } from './vector.utils.js'

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

function filterChunksByThreshold(
  rows: RetrievedChunk[],
  similarityThreshold: number,
  topK: number,
): RetrievedChunk[] {
  return rows
    .filter((row) => row.distance <= similarityThreshold)
    .sort((left, right) => left.distance - right.distance)
    .slice(0, topK)
}

async function retrieveViaRpc(
  organizationId: string,
  queryEmbedding: number[],
  topK: number,
  similarityThreshold: number,
): Promise<RetrievedChunk[] | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.rpc('match_organization_document_chunks', {
    query_embedding: queryEmbedding,
    match_organization_id: organizationId,
    match_count: topK,
  })

  if (error !== null) {
    logger.warn(`Knowledge RPC retrieval failed: ${error.message}`)
    return null
  }

  const rows = (data ?? []) as MatchRow[]
  const chunks: RetrievedChunk[] = rows.map((row) => ({
    id: row.id,
    content: row.content,
    source_type: row.source_type,
    source_ref: row.source_ref,
    distance: Number(row.distance),
  }))

  return filterChunksByThreshold(chunks, similarityThreshold, topK)
}

async function retrieveViaMemory(
  organizationId: string,
  queryEmbedding: number[],
  topK: number,
  similarityThreshold: number,
): Promise<RetrievedChunk[]> {
  const storedChunks = await findDocumentChunksForRetrieval(organizationId)

  const ranked = storedChunks
    .map((chunk) => {
      const embedding = chunk.embedding
      if (embedding === null) {
        return null
      }

      return {
        id: chunk.id,
        content: chunk.content,
        source_type: chunk.source_type,
        source_ref: chunk.source_ref,
        distance: cosineDistance(queryEmbedding, embedding),
      }
    })
    .filter((chunk): chunk is RetrievedChunk => chunk !== null)

  return filterChunksByThreshold(ranked, similarityThreshold, topK)
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

  const topK = env.KNOWLEDGE_RETRIEVAL_TOP_K
  const similarityThreshold = env.KNOWLEDGE_SIMILARITY_THRESHOLD

  const rpcChunks = await retrieveViaRpc(organizationId, queryEmbedding, topK, similarityThreshold)
  if (rpcChunks !== null) {
    return rpcChunks
  }

  return retrieveViaMemory(organizationId, queryEmbedding, topK, similarityThreshold)
}
