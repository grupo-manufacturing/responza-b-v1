import type { AuthContext } from '../../shared/auth/index.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import { INGESTION_PREVIEW_LENGTH } from './knowledge.constants.js'
import {
  createIngestJob,
  createIndexJob,
  getKnowledgeJob,
  retryKnowledgeJob,
} from './jobs/knowledge-job.service.js'
import type { KnowledgeJobCreatedResponse, KnowledgeJobResponse } from './jobs/knowledge-job.service.js'
import {
  countDocumentChunksByOrganizationId,
  countDocumentChunksBySourceType,
} from './repositories/document-chunk.repository.js'
import {
  countIngestedSourcesByOrganizationId,
  findIngestedSourcesByOrganizationId,
} from './repositories/ingested-source.repository.js'
import { askBusinessAgent, toAskSourceReferences } from './ask/ask.service.js'
import { ASK_SOURCE_PREVIEW_LENGTH } from './knowledge.constants.js'
import type { AskBody } from './knowledge.schemas.js'

export type IngestionSourceResponse = {
  id: string
  source_type: string
  source_ref: string | null
  char_count: number
  content_preview: string
  created_at: string
}

export type IngestionResponse = {
  organizationId: string
  sources_ingested: number
  total_characters: number
  sources: IngestionSourceResponse[]
  errors: string[]
}

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

export async function startIngestion(auth: AuthContext): Promise<KnowledgeJobCreatedResponse> {
  return createIngestJob(auth.organizationId)
}

export async function getIngestionResults(auth: AuthContext): Promise<IngestionResponse> {
  const sources = await findIngestedSourcesByOrganizationId(auth.organizationId)

  if (sources.length === 0) {
    throw new AppError(
      404,
      'INGESTED_CONTENT_NOT_FOUND',
      'No ingested content found. Run ingestion first.',
    )
  }

  return {
    organizationId: auth.organizationId,
    sources_ingested: sources.length,
    total_characters: sources.reduce((total, source) => total + source.content.length, 0),
    sources: sources.map((source) => ({
      id: source.id,
      source_type: source.source_type,
      source_ref: source.source_ref,
      char_count: source.content.length,
      content_preview: source.content.slice(0, INGESTION_PREVIEW_LENGTH),
      created_at: source.created_at,
    })),
    errors: [],
  }
}

export async function startIndexing(auth: AuthContext): Promise<KnowledgeJobCreatedResponse> {
  const ingestedCount = await countIngestedSourcesByOrganizationId(auth.organizationId)
  if (ingestedCount === 0) {
    throw new AppError(
      422,
      'INDEXING_NO_INGESTED_CONTENT',
      'No ingested content found. Run ingestion before indexing.',
    )
  }

  return createIndexJob(auth.organizationId)
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

export async function getJobStatus(auth: AuthContext, jobId: string): Promise<KnowledgeJobResponse> {
  return getKnowledgeJob(auth.organizationId, jobId)
}

export async function retryJob(auth: AuthContext, jobId: string): Promise<KnowledgeJobCreatedResponse> {
  return retryKnowledgeJob(auth.organizationId, jobId)
}
