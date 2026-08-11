import type { AuthContext } from '../../shared/auth/index.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import { askBusinessAgent, toAskSourceReferences } from './ask/ask.service.js'
import { ASK_SOURCE_PREVIEW_LENGTH } from './knowledge.constants.js'
import type { AskBody } from './knowledge.schemas.js'
import {
  countDocumentChunksByOrganizationId,
  countDocumentChunksBySourceType,
} from './repositories/document-chunk.repository.js'

export type KnowledgeBaseSourceSummary = {
  source_type: string
  chunk_count: number
}

export type KnowledgeBaseResponse = {
  organizationId: string
  chunks_created: number
  sources_processed: number
  embedding_model: string
  embedding_dimensions: number
  chunks_by_source: KnowledgeBaseSourceSummary[]
}

export type AskSourceResponse = {
  id: string
  source_type: string
  source_ref: string | null
  similarity: number
  content_preview: string
}

export type AskResponse = {
  organizationId: string
  question: string
  answer: string
  is_fallback: boolean
  sources: AskSourceResponse[]
}

export async function getKnowledgeBase(auth: AuthContext): Promise<KnowledgeBaseResponse> {
  const env = loadEnv()
  const totalChunks = await countDocumentChunksByOrganizationId(auth.organizationId)

  if (totalChunks === 0) {
    throw new AppError(
      404,
      'KNOWLEDGE_BASE_NOT_FOUND',
      'Knowledge base not found. Run indexing first.',
    )
  }

  const chunksBySource = await countDocumentChunksBySourceType(auth.organizationId)

  return {
    organizationId: auth.organizationId,
    chunks_created: totalChunks,
    sources_processed: chunksBySource.length,
    embedding_model: env.KNOWLEDGE_EMBEDDING_MODEL,
    embedding_dimensions: env.KNOWLEDGE_EMBEDDING_DIMENSIONS,
    chunks_by_source: chunksBySource,
  }
}

export async function askQuestion(auth: AuthContext, input: AskBody): Promise<AskResponse> {
  const totalChunks = await countDocumentChunksByOrganizationId(auth.organizationId)
  if (totalChunks === 0) {
    throw new AppError(
      404,
      'KNOWLEDGE_BASE_NOT_FOUND',
      'Knowledge base not found. Build the knowledge base first.',
    )
  }

  const question = input.question.trim()
  const result = await askBusinessAgent(auth.organizationId, question)

  return {
    organizationId: auth.organizationId,
    question,
    answer: result.answer,
    is_fallback: result.is_fallback,
    sources: toAskSourceReferences(result.sources, ASK_SOURCE_PREVIEW_LENGTH),
  }
}
