import type { ErrorCode } from '../../shared/errors/index.js'
import { getCachedJson, setCachedJson } from '../../shared/redis/cache.js'
import { buildCacheKey, CACHE_NAMESPACES } from '../../shared/redis/keys.js'
import type { AiJobType } from '../../shared/queue/ai.queue.js'

export type AiJobStatus = 'pending' | 'completed' | 'failed'

export type AiJobError = {
  code: ErrorCode
  message: string
}

export type AiJobRecord = {
  id: string
  organizationId: string
  type: AiJobType
  status: AiJobStatus
  result?: unknown
  error?: AiJobError
  createdAt: string
  completedAt?: string
}

export type AiJobEnqueueResponse = {
  jobId: string
  status: 'pending'
}

export type AiJobStatusResponse = {
  jobId: string
  status: AiJobStatus
  type: AiJobType
  result?: unknown
  error?: AiJobError
}

function aiJobCacheKey(organizationId: string, jobId: string): string {
  return buildCacheKey(CACHE_NAMESPACES.aiJob, organizationId, jobId)
}

export async function createPendingAiJob(input: {
  jobId: string
  organizationId: string
  type: AiJobType
  ttlSeconds: number
}): Promise<AiJobRecord> {
  const record: AiJobRecord = {
    id: input.jobId,
    organizationId: input.organizationId,
    type: input.type,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  await setCachedJson(
    aiJobCacheKey(input.organizationId, input.jobId),
    record,
    input.ttlSeconds,
  )

  return record
}

export async function getAiJobRecord(
  organizationId: string,
  jobId: string,
): Promise<AiJobRecord | null> {
  return getCachedJson<AiJobRecord>(aiJobCacheKey(organizationId, jobId))
}

async function updateAiJobRecord(
  organizationId: string,
  jobId: string,
  ttlSeconds: number,
  patch: Partial<Pick<AiJobRecord, 'status' | 'result' | 'error' | 'completedAt'>>,
): Promise<void> {
  const existing = await getAiJobRecord(organizationId, jobId)
  if (existing === null) {
    return
  }

  await setCachedJson(
    aiJobCacheKey(organizationId, jobId),
    { ...existing, ...patch },
    ttlSeconds,
  )
}

export async function markAiJobCompleted(input: {
  organizationId: string
  jobId: string
  result: unknown
  ttlSeconds: number
}): Promise<void> {
  await updateAiJobRecord(input.organizationId, input.jobId, input.ttlSeconds, {
    status: 'completed',
    result: input.result,
    error: undefined,
    completedAt: new Date().toISOString(),
  })
}

export async function markAiJobFailed(input: {
  organizationId: string
  jobId: string
  error: AiJobError
  ttlSeconds: number
}): Promise<void> {
  await updateAiJobRecord(input.organizationId, input.jobId, input.ttlSeconds, {
    status: 'failed',
    result: undefined,
    error: input.error,
    completedAt: new Date().toISOString(),
  })
}

export function toAiJobStatusResponse(record: AiJobRecord): AiJobStatusResponse {
  return {
    jobId: record.id,
    status: record.status,
    type: record.type,
    result: record.status === 'completed' ? record.result : undefined,
    error: record.status === 'failed' ? record.error : undefined,
  }
}
