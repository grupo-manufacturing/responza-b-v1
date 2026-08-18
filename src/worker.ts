import type { Job } from 'bullmq'

import { loadEnv } from './shared/config/index.js'
import { processAiQueueJob } from './modules/ai/ai.jobs.service.js'
import { runAgentDraftReply } from './modules/inbox/agent-draft-reply.service.js'
import { processKnowledgeQueueJob } from './modules/knowledge/jobs/knowledge-job.worker.js'
import { processInboundMediaIngestionJob } from './modules/media/media.ingestion.worker.js'
import { processInstagramWebhookJob, processWhatsAppWebhookJob } from './modules/messaging/webhook.worker.js'
import { logger } from './shared/logger.js'
import {
  AI_JOB_NAMES,
  AI_QUEUE_NAME,
  closeAiQueue,
  type AiQueueJobData,
  type AgentDraftReplyPayload,
} from './shared/queue/ai.queue.js'
import {
  KNOWLEDGE_JOB_NAMES,
  KNOWLEDGE_QUEUE_NAME,
  closeKnowledgeQueue,
  type KnowledgeQueueJobData,
} from './shared/queue/knowledge.queue.js'
import {
  MEDIA_JOB_NAMES,
  MEDIA_QUEUE_NAME,
  closeMediaQueue,
  type InboundMediaIngestionJobData,
} from './shared/queue/media.queue.js'
import {
  WEBHOOK_JOB_NAMES,
  WEBHOOK_QUEUE_NAME,
  closeWebhookQueue,
  type InstagramWebhookJobData,
  type WhatsAppWebhookJobData,
} from './shared/queue/webhook.queue.js'
import { createTimedQueueWorker, isQueueJobLastAttempt } from './shared/queue/worker.utils.js'
import { closeRedisConnection } from './shared/redis/index.js'

const env = loadEnv()

let shuttingDown = false

const webhookJobHandlers = {
  [WEBHOOK_JOB_NAMES.whatsapp]: {
    label: 'WhatsApp',
    process: (data: WhatsAppWebhookJobData) => processWhatsAppWebhookJob(data),
  },
  [WEBHOOK_JOB_NAMES.instagram]: {
    label: 'Instagram',
    process: (data: InstagramWebhookJobData) => processInstagramWebhookJob(data),
  },
} as const

async function processWebhookJob(job: Job): Promise<void> {
  const handler = webhookJobHandlers[job.name as keyof typeof webhookJobHandlers]
  if (handler === undefined) {
    throw new Error(`Unhandled webhook job type: ${job.name}`)
  }

  await handler.process(job.data as WhatsAppWebhookJobData & InstagramWebhookJobData)
  logger.info(`${handler.label} webhook job processed: ${job.id ?? 'unknown'}`)
}

async function processMediaJob(job: Job): Promise<void> {
  if (job.name !== MEDIA_JOB_NAMES.ingest) {
    throw new Error(`Unhandled media job type: ${job.name}`)
  }

  await processInboundMediaIngestionJob(job.data as InboundMediaIngestionJobData)
  logger.info(`Media ingestion job processed: ${job.id ?? 'unknown'}`)
}

async function processAiJob(job: Job): Promise<void> {
  if (job.name !== AI_JOB_NAMES.run) {
    throw new Error(`Unhandled AI job type: ${job.name}`)
  }

  const data = job.data as AiQueueJobData
  if (data.type === 'agent-draft-reply') {
    await runAgentDraftReply(data.payload as AgentDraftReplyPayload)
    logger.info(`Agent draft reply job processed: ${job.id ?? 'unknown'}`)
    return
  }

  await processAiQueueJob(data, {
    markFailed: isQueueJobLastAttempt(job),
  })
  logger.info(`AI job processed: ${job.id ?? 'unknown'}`)
}

async function processKnowledgeJob(job: Job): Promise<void> {
  if (job.name !== KNOWLEDGE_JOB_NAMES.ingest && job.name !== KNOWLEDGE_JOB_NAMES.index) {
    throw new Error(`Unhandled knowledge job type: ${job.name}`)
  }

  await processKnowledgeQueueJob(job.name, job.data as KnowledgeQueueJobData)
  logger.info(`Knowledge job processed: ${job.id ?? 'unknown'}`)
}

const workers = [
  createTimedQueueWorker({
    queueName: WEBHOOK_QUEUE_NAME,
    timeoutMs: env.WEBHOOK_JOB_TIMEOUT_MS,
    concurrency: env.WEBHOOK_WORKER_CONCURRENCY,
    timeoutLabel: 'Webhook job',
    processJob: processWebhookJob,
  }),
  createTimedQueueWorker({
    queueName: MEDIA_QUEUE_NAME,
    timeoutMs: env.MEDIA_JOB_TIMEOUT_MS,
    concurrency: env.MEDIA_WORKER_CONCURRENCY,
    timeoutLabel: 'Media ingestion job',
    processJob: processMediaJob,
  }),
  createTimedQueueWorker({
    queueName: AI_QUEUE_NAME,
    timeoutMs: env.AI_JOB_TIMEOUT_MS,
    concurrency: env.AI_WORKER_CONCURRENCY,
    timeoutLabel: 'AI job',
    processJob: processAiJob,
  }),
  createTimedQueueWorker({
    queueName: KNOWLEDGE_QUEUE_NAME,
    timeoutMs: env.KNOWLEDGE_JOB_TIMEOUT_MS,
    concurrency: env.KNOWLEDGE_WORKER_CONCURRENCY,
    timeoutLabel: 'Knowledge job',
    processJob: processKnowledgeJob,
  }),
]

const closeQueues = [closeWebhookQueue, closeMediaQueue, closeAiQueue, closeKnowledgeQueue]

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(`Shutting down worker (${signal})`)

  for (const worker of workers) {
    await worker.close()
  }

  for (const closeQueue of closeQueues) {
    await closeQueue()
  }

  await closeRedisConnection()
}

function handleShutdownSignal(signal: string): void {
  void shutdown(signal)
    .then(() => {
      process.exit(0)
    })
    .catch((error: unknown) => {
      logger.error(error)
      process.exit(1)
    })
}

process.on('SIGINT', () => {
  handleShutdownSignal('SIGINT')
})

process.on('SIGTERM', () => {
  handleShutdownSignal('SIGTERM')
})

logger.info(
  `Workers started (webhooks: ${WEBHOOK_QUEUE_NAME} x${env.WEBHOOK_WORKER_CONCURRENCY}, media: ${MEDIA_QUEUE_NAME} x${env.MEDIA_WORKER_CONCURRENCY}, ai: ${AI_QUEUE_NAME} x${env.AI_WORKER_CONCURRENCY}, knowledge: ${KNOWLEDGE_QUEUE_NAME} x${env.KNOWLEDGE_WORKER_CONCURRENCY})`,
)
