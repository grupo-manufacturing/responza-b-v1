import type { AuthContext } from '../../shared/auth/index.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import {
  countDocumentChunksByOrganizationId,
  countDocumentChunksBySourceType,
} from './repositories/document-chunk.repository.js'
import {
  findAnyActiveKnowledgeJob,
  findLatestCompletedIndexJob,
  findLatestFailedKnowledgeJob,
} from './repositories/knowledge-job.repository.js'

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

export type AgentStatus = 'ready' | 'building' | 'not_built' | 'failed'

export type AgentStatusResponse = {
  status: AgentStatus
  chunkCount: number
  lastError: string | null
  lastBuiltAt: string | null
}

export async function getAgentStatus(auth: AuthContext): Promise<AgentStatusResponse> {
  const organizationId = auth.organizationId
  const chunkCount = await countDocumentChunksByOrganizationId(organizationId)
  const activeJob = await findAnyActiveKnowledgeJob(organizationId)

  if (activeJob !== null) {
    return {
      status: 'building',
      chunkCount,
      lastError: null,
      lastBuiltAt: null,
    }
  }

  if (chunkCount > 0) {
    const latestIndexJob = await findLatestCompletedIndexJob(organizationId)

    return {
      status: 'ready',
      chunkCount,
      lastError: null,
      lastBuiltAt: latestIndexJob?.completed_at ?? null,
    }
  }

  const latestFailedJob = await findLatestFailedKnowledgeJob(organizationId)
  if (latestFailedJob !== null) {
    return {
      status: 'failed',
      chunkCount: 0,
      lastError: latestFailedJob.error,
      lastBuiltAt: null,
    }
  }

  return {
    status: 'not_built',
    chunkCount: 0,
    lastError: null,
    lastBuiltAt: null,
  }
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
