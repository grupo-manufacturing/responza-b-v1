import { Worker, type Job } from 'bullmq'

import { logger } from '../logger.js'
import { getRedisConnectionOptions } from '../redis/index.js'

export type TimedQueueWorkerConfig = {
  queueName: string
  timeoutMs: number
  concurrency: number
  timeoutLabel: string
  processJob: (job: Job) => Promise<void>
}

export function isDuplicateQueueJobError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('Job already exists')
}

export async function withJobTimeout<T>(
  timeoutMs: number,
  run: () => Promise<T>,
  timeoutMessage = 'Job timed out',
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      run(),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(timeoutMessage))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

function readOrganizationId(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined
  }

  const organizationId = Reflect.get(data, 'organizationId')
  return typeof organizationId === 'string' ? organizationId : undefined
}

export function isQueueJobLastAttempt(job: Job): boolean {
  const maxAttempts = job.opts.attempts ?? 1
  return job.attemptsMade + 1 >= maxAttempts
}

export function logWorkerJobFailure(queueName: string, job: Job | undefined, error: Error): void {
  const maxAttempts = job?.opts?.attempts ?? 1
  const attemptsMade = job?.attemptsMade ?? 0
  const exhausted = attemptsMade + 1 >= maxAttempts

  const context = {
    queue: queueName,
    jobId: job?.id ?? null,
    jobName: job?.name ?? null,
    attemptsMade,
    maxAttempts,
    willRetry: !exhausted,
    organizationId: readOrganizationId(job?.data),
    error: error.message,
    errorName: error.name,
  }

  if (exhausted) {
    logger.warn('Worker job exhausted retries', context)
    return
  }

  logger.warn('Worker job attempt failed', context)
}

export function createTimedQueueWorker(config: TimedQueueWorkerConfig): Worker {
  const worker = new Worker(
    config.queueName,
    async (job) => {
      await withJobTimeout(
        config.timeoutMs,
        async () => config.processJob(job),
        `${config.timeoutLabel} timed out after ${config.timeoutMs}ms`,
      )
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: config.concurrency,
    },
  )

  attachWorkerLifecycleLogs(worker, config.queueName)
  return worker
}

export function attachWorkerLifecycleLogs(worker: Worker, queueName: string): void {
  worker.on('failed', (job, error) => {
    logWorkerJobFailure(queueName, job, error)
  })

  worker.on('stalled', (jobId) => {
    logger.warn('Worker job stalled', {
      queue: queueName,
      jobId,
    })
  })
}
