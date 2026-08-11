import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import { logger } from '../../../shared/logger.js'
import {
  KNOWLEDGE_JOB_NAMES,
  enqueueKnowledgeJob,
} from '../../../shared/queue/knowledge.queue.js'
import { ingestBusinessData } from '../ingestion/ingest.service.js'
import { buildKnowledgeBase } from '../indexing/indexing.service.js'
import type { KnowledgeJobRecord, KnowledgeJobType } from './knowledge-job.types.js'
import {
  createKnowledgeJob,
  findActiveKnowledgeJob,
  findKnowledgeJobById,
  findKnowledgeJobByOrganizationId,
  markKnowledgeJobCompleted,
  markKnowledgeJobFailed,
  markKnowledgeJobRunning,
  resetKnowledgeJobForRetry,
} from '../repositories/knowledge-job.repository.js'
import {
  deleteIngestedSourcesByOrganizationId,
  findIngestedSourcesByOrganizationId,
  insertIngestedSources,
} from '../repositories/ingested-source.repository.js'
import {
  deleteDocumentChunksByOrganizationId,
  insertDocumentChunks,
} from '../repositories/document-chunk.repository.js'

const JOB_ACCEPTED_MESSAGE = 'Job accepted. Poll GET /api/knowledge/jobs/{jobId} for status.'
const JOB_RETRY_MESSAGE = 'Job retry accepted. Poll GET /api/knowledge/jobs/{jobId} for status.'

export type KnowledgeJobResponse = {
  id: string
  organizationId: string
  type: KnowledgeJobRecord['type']
  status: KnowledgeJobRecord['status']
  error: string | null
  attempts: number
  maxAttempts: number
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  updatedAt: string
}

export type KnowledgeJobCreatedResponse = {
  job: KnowledgeJobResponse
  message: string
}

function maxAttempts(): number {
  return loadEnv().KNOWLEDGE_JOB_MAX_ATTEMPTS
}

function retryDelaySeconds(attempts: number): number {
  const baseDelay = loadEnv().KNOWLEDGE_JOB_RETRY_DELAY_SECONDS
  return baseDelay * 2 ** Math.max(attempts - 1, 0)
}

export function toKnowledgeJobResponse(record: KnowledgeJobRecord): KnowledgeJobResponse {
  return {
    id: record.id,
    organizationId: record.organization_id,
    type: record.type,
    status: record.status,
    error: record.error,
    attempts: record.attempts,
    maxAttempts: record.max_attempts,
    createdAt: record.created_at,
    startedAt: record.started_at,
    completedAt: record.completed_at,
    updatedAt: record.updated_at,
  }
}

async function ensureNoActiveJob(organizationId: string, type: KnowledgeJobType): Promise<void> {
  const activeJob = await findActiveKnowledgeJob(organizationId, type)
  if (activeJob !== null) {
    throw new AppError(
      409,
      'JOB_IN_PROGRESS',
      `A ${type} job is already in progress for this organization.`,
      { type },
    )
  }
}

async function scheduleKnowledgeJobRun(job: KnowledgeJobRecord, delayMs = 0): Promise<void> {
  const jobName = job.type === 'ingest' ? KNOWLEDGE_JOB_NAMES.ingest : KNOWLEDGE_JOB_NAMES.index
  await enqueueKnowledgeJob(jobName, { jobId: job.id }, { delayMs })
}

export async function enqueueKnowledgeBuildForOrganization(organizationId: string): Promise<void> {
  try {
    await createIngestJob(organizationId)
    logger.info(`Knowledge build started for organization ${organizationId}`)
  } catch (error) {
    if (error instanceof AppError && error.code === 'JOB_IN_PROGRESS') {
      logger.info(`Knowledge build already in progress for organization ${organizationId}`)
      return
    }

    logger.error(
      error instanceof Error
        ? error
        : new Error(`Failed to start knowledge build for organization ${organizationId}`),
    )
  }
}

export async function createIngestJob(organizationId: string): Promise<KnowledgeJobCreatedResponse> {
  await ensureNoActiveJob(organizationId, 'ingest')

  const job = await createKnowledgeJob({
    organizationId,
    type: 'ingest',
    maxAttempts: maxAttempts(),
  })

  await scheduleKnowledgeJobRun(job)

  return {
    job: toKnowledgeJobResponse(job),
    message: JOB_ACCEPTED_MESSAGE,
  }
}

export async function createIndexJob(organizationId: string): Promise<KnowledgeJobCreatedResponse> {
  await ensureNoActiveJob(organizationId, 'index')

  const job = await createKnowledgeJob({
    organizationId,
    type: 'index',
    maxAttempts: maxAttempts(),
  })

  await scheduleKnowledgeJobRun(job)

  return {
    job: toKnowledgeJobResponse(job),
    message: JOB_ACCEPTED_MESSAGE,
  }
}

export async function getKnowledgeJob(organizationId: string, jobId: string): Promise<KnowledgeJobResponse> {
  const job = await findKnowledgeJobByOrganizationId(organizationId, jobId)
  if (job === null) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.')
  }

  return toKnowledgeJobResponse(job)
}

export async function retryKnowledgeJob(
  organizationId: string,
  jobId: string,
): Promise<KnowledgeJobCreatedResponse> {
  const job = await findKnowledgeJobByOrganizationId(organizationId, jobId)
  if (job === null) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.')
  }

  if (job.status !== 'failed') {
    throw new AppError(409, 'JOB_NOT_RETRYABLE', 'Only failed jobs can be retried.')
  }

  await ensureNoActiveJob(organizationId, job.type)
  const resetJob = await resetKnowledgeJobForRetry(job.id)
  await scheduleKnowledgeJobRun(resetJob)

  return {
    job: toKnowledgeJobResponse(resetJob),
    message: JOB_RETRY_MESSAGE,
  }
}

export async function handleKnowledgeJobFailure(
  jobId: string,
  errorMessage: string,
  options: { retryable: boolean },
): Promise<void> {
  const job = await findKnowledgeJobById(jobId)
  if (job === null) {
    logger.error(`Knowledge job failure handler could not find job ${jobId}`)
    return
  }

  if (options.retryable && job.attempts < job.max_attempts) {
    const resetJob = await resetKnowledgeJobForRetry(jobId)
    const delayMs = retryDelaySeconds(job.attempts) * 1000

    logger.warn(
      `Scheduling knowledge job retry: jobId=${jobId} attempts=${job.attempts} maxAttempts=${job.max_attempts} delayMs=${delayMs}`,
    )

    await scheduleKnowledgeJobRun(resetJob, delayMs)
    return
  }

  await markKnowledgeJobFailed(jobId, errorMessage)
}

export async function runIngestJob(jobId: string): Promise<void> {
  const job = await findKnowledgeJobById(jobId)
  if (job === null) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.')
  }

  await markKnowledgeJobRunning(jobId)

  try {
    await deleteIngestedSourcesByOrganizationId(job.organization_id)
    const ingestion = await ingestBusinessData(job.organization_id)

    if (ingestion.sources.length === 0) {
      const errorMessage =
        ingestion.errors.length > 0
          ? ingestion.errors.join('; ')
          : 'Ingestion completed with no extracted content.'

      await markKnowledgeJobFailed(jobId, errorMessage)
      logger.info(`Ingest job finished with failure: jobId=${jobId} organizationId=${job.organization_id}`)
      return
    }

    await insertIngestedSources(job.organization_id, ingestion.sources)
    await markKnowledgeJobCompleted(jobId)
    logger.info(`Ingest job finished: jobId=${jobId} organizationId=${job.organization_id}`)

    try {
      await createIndexJob(job.organization_id)
      logger.info(`Index job scheduled after ingest for organization ${job.organization_id}`)
    } catch (indexError) {
      logger.error(indexError)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ingest job failed'
    logger.error(error)
    const retryable = !(error instanceof AppError && error.statusCode < 500)
    await handleKnowledgeJobFailure(jobId, message, { retryable })
  }
}

export async function runIndexJob(jobId: string): Promise<void> {
  const job = await findKnowledgeJobById(jobId)
  if (job === null) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.')
  }

  await markKnowledgeJobRunning(jobId)

  try {
    const ingestedSources = await findIngestedSourcesByOrganizationId(job.organization_id)

    if (ingestedSources.length === 0) {
      await markKnowledgeJobFailed(jobId, 'No ingested content found. Run ingestion before indexing.')
      logger.info(`Index job finished with failure: jobId=${jobId} organizationId=${job.organization_id}`)
      return
    }

    const { documentChunks } = await buildKnowledgeBase(ingestedSources)

    await deleteDocumentChunksByOrganizationId(job.organization_id)

    for (let index = 0; index < documentChunks.length; index += 100) {
      const batch = documentChunks.slice(index, index + 100)
      await insertDocumentChunks(job.organization_id, batch)
    }

    await markKnowledgeJobCompleted(jobId)
    logger.info(`Index job finished: jobId=${jobId} organizationId=${job.organization_id}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Index job failed'
    logger.error(error)

    let retryable = true
    if (error instanceof AppError) {
      retryable = error.statusCode >= 500
    } else if (error instanceof Error) {
      const isIndexingValueError =
        message.includes('No ingested content found') ||
        message.includes('No chunks generated from ingested content')
      retryable = !isIndexingValueError
    }

    await handleKnowledgeJobFailure(jobId, message, { retryable })
  }
}
