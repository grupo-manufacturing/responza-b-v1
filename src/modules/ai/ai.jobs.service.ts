import { randomUUID } from 'node:crypto'

import type { AuthContext } from '../../shared/auth/index.js'
import { AppError, isAppError } from '../../shared/errors/index.js'
import { loadEnv } from '../../shared/config/index.js'
import { enqueueAiJob, type AiJobType, type AiQueueJobData } from '../../shared/queue/ai.queue.js'
import {
  analyzeConversation,
  rewriteDraft,
  suggestReply,
  translateMessage,
  validateAnalyzeConversation,
  validateSuggestReply,
  validateTranslateMessage,
} from './ai.service.js'
import {
  createPendingAiJob,
  getAiJobRecord,
  markAiJobCompleted,
  markAiJobFailed,
  toAiJobStatusResponse,
  type AiJobEnqueueResponse,
  type AiJobError,
  type AiJobStatusResponse,
} from './ai.job.store.js'
import type {
  ConversationAnalyticsBody,
  RewriteBody,
  SuggestReplyBody,
  TranslateBody,
} from './ai.schemas.js'

function jobTtlSeconds(): number {
  return loadEnv().AI_JOB_TTL_SECONDS
}

function toAuthContext(organizationId: string): AuthContext {
  return {
    organizationId,
    email: '',
    name: '',
  }
}

function toJobError(error: unknown): AiJobError {
  if (isAppError(error)) {
    return {
      code: error.code,
      message: error.message,
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: 'AI job failed',
  }
}

async function enqueueJob<T extends AiJobType>(
  auth: AuthContext,
  type: T,
  payload: AiQueueJobData<T>['payload'],
): Promise<AiJobEnqueueResponse> {
  const jobId = randomUUID()
  const ttlSeconds = jobTtlSeconds()

  await createPendingAiJob({
    jobId,
    organizationId: auth.organizationId,
    type,
    ttlSeconds,
  })

  await enqueueAiJob({
    jobId,
    organizationId: auth.organizationId,
    type,
    payload,
  })

  return {
    jobId,
    status: 'pending',
  }
}

export async function enqueueRewriteJob(
  auth: AuthContext,
  input: RewriteBody,
): Promise<AiJobEnqueueResponse> {
  return enqueueJob(auth, 'rewrite', input)
}

export async function enqueueTranslateJob(
  auth: AuthContext,
  input: TranslateBody,
): Promise<AiJobEnqueueResponse> {
  await validateTranslateMessage(auth, input)
  return enqueueJob(auth, 'translate', input)
}

export async function enqueueSuggestReplyJob(
  auth: AuthContext,
  input: SuggestReplyBody,
): Promise<AiJobEnqueueResponse> {
  await validateSuggestReply(auth, input)
  return enqueueJob(auth, 'suggest-reply', input)
}

export async function enqueueConversationAnalyticsJob(
  auth: AuthContext,
  input: ConversationAnalyticsBody,
): Promise<AiJobEnqueueResponse> {
  await validateAnalyzeConversation(auth, input)
  return enqueueJob(auth, 'conversation-analytics', input)
}

export async function getAiJobStatus(
  auth: AuthContext,
  jobId: string,
): Promise<AiJobStatusResponse> {
  const record = await getAiJobRecord(auth.organizationId, jobId)
  if (record === null) {
    throw new AppError(404, 'NOT_FOUND', 'AI job not found')
  }

  return toAiJobStatusResponse(record)
}

export async function executeAiQueueJob(data: AiQueueJobData): Promise<unknown> {
  const auth = toAuthContext(data.organizationId)

  switch (data.type) {
    case 'rewrite':
      return rewriteDraft(data.payload as RewriteBody)
    case 'translate':
      return translateMessage(auth, data.payload as TranslateBody)
    case 'suggest-reply':
      return suggestReply(auth, data.payload as SuggestReplyBody)
    case 'conversation-analytics':
      return analyzeConversation(auth, data.payload as ConversationAnalyticsBody)
    default: {
      const exhaustive: never = data.type
      throw new AppError(500, 'INTERNAL_ERROR', `Unsupported AI job type: ${String(exhaustive)}`)
    }
  }
}

export async function processAiQueueJob(
  data: AiQueueJobData,
  options: { markFailed: boolean },
): Promise<void> {
  const ttlSeconds = jobTtlSeconds()
  const existing = await getAiJobRecord(data.organizationId, data.jobId)

  if (existing?.status === 'completed') {
    return
  }

  if (existing?.status === 'failed') {
    return
  }

  try {
    const result = await executeAiQueueJob(data)
    await markAiJobCompleted({
      organizationId: data.organizationId,
      jobId: data.jobId,
      result,
      ttlSeconds,
    })
  } catch (error) {
    if (options.markFailed) {
      await markAiJobFailed({
        organizationId: data.organizationId,
        jobId: data.jobId,
        error: toJobError(error),
        ttlSeconds,
      })
    }

    throw error
  }
}
