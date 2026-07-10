import { Worker } from 'bullmq'

import { loadEnv } from './shared/config/index.js'
import { processAiQueueJob } from './modules/ai/ai.jobs.service.js'
import { processAgentEvaluateJob } from './modules/agent/agent.worker.js'
import { processInboundMediaIngestionJob } from './modules/media/media.ingestion.worker.js'
import {
  processKnowledgeIndexJob,
  processKnowledgeRefreshInstagramJob,
  processKnowledgeRefreshWebsiteJob,
  processKnowledgeRemoveCatalogueJob,
} from './modules/knowledge/knowledge.worker.js'
import { registerKnowledgeScheduler } from './modules/knowledge/knowledge.scheduler.js'
import { processInstagramWebhookJob, processWhatsAppWebhookJob } from './modules/messaging/webhook.worker.js'
import { logger } from './shared/logger.js'
import {
  AGENT_JOB_NAMES,
  AGENT_QUEUE_NAME,
  closeAgentQueue,
  type AgentEvaluateJobData,
} from './shared/queue/agent.queue.js'
import {
  AI_JOB_NAMES,
  AI_QUEUE_NAME,
  closeAiQueue,
  type AiQueueJobData,
} from './shared/queue/ai.queue.js'
import {
  KNOWLEDGE_JOB_NAMES,
  KNOWLEDGE_QUEUE_NAME,
  closeKnowledgeQueue,
  type KnowledgeIndexJobData,
  type KnowledgeRemoveCatalogueJobData,
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
import {
  attachWorkerLifecycleLogs,
  isQueueJobLastAttempt,
  withJobTimeout,
} from './shared/queue/worker.utils.js'
import { closeRedisConnection, getRedisConnectionOptions } from './shared/redis/index.js'

const env = loadEnv()

let shuttingDown = false

const webhookWorker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job) => {
    await withJobTimeout(
      env.WEBHOOK_JOB_TIMEOUT_MS,
      async () => {
        if (job.name === WEBHOOK_JOB_NAMES.whatsapp) {
          await processWhatsAppWebhookJob(job.data as WhatsAppWebhookJobData)
          logger.info(`WhatsApp webhook job processed: ${job.id ?? 'unknown'}`)
          return
        }

        if (job.name === WEBHOOK_JOB_NAMES.instagram) {
          await processInstagramWebhookJob(job.data as InstagramWebhookJobData)
          logger.info(`Instagram webhook job processed: ${job.id ?? 'unknown'}`)
          return
        }

        throw new Error(`Unhandled webhook job type: ${job.name}`)
      },
      `Webhook job timed out after ${env.WEBHOOK_JOB_TIMEOUT_MS}ms`,
    )
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: env.WEBHOOK_WORKER_CONCURRENCY,
  },
)

const mediaWorker = new Worker(
  MEDIA_QUEUE_NAME,
  async (job) => {
    await withJobTimeout(
      env.MEDIA_JOB_TIMEOUT_MS,
      async () => {
        if (job.name === MEDIA_JOB_NAMES.ingest) {
          await processInboundMediaIngestionJob(job.data as InboundMediaIngestionJobData)
          logger.info(`Media ingestion job processed: ${job.id ?? 'unknown'}`)
          return
        }

        throw new Error(`Unhandled media job type: ${job.name}`)
      },
      `Media ingestion job timed out after ${env.MEDIA_JOB_TIMEOUT_MS}ms`,
    )
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: env.MEDIA_WORKER_CONCURRENCY,
  },
)

const aiWorker = new Worker(
  AI_QUEUE_NAME,
  async (job) => {
    await withJobTimeout(
      env.AI_JOB_TIMEOUT_MS,
      async () => {
        if (job.name === AI_JOB_NAMES.run) {
          await processAiQueueJob(job.data as AiQueueJobData, {
            markFailed: isQueueJobLastAttempt(job),
          })
          logger.info(`AI job processed: ${job.id ?? 'unknown'}`)
          return
        }

        throw new Error(`Unhandled AI job type: ${job.name}`)
      },
      `AI job timed out after ${env.AI_JOB_TIMEOUT_MS}ms`,
    )
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: env.AI_WORKER_CONCURRENCY,
  },
)

attachWorkerLifecycleLogs(webhookWorker, WEBHOOK_QUEUE_NAME)
attachWorkerLifecycleLogs(mediaWorker, MEDIA_QUEUE_NAME)
attachWorkerLifecycleLogs(aiWorker, AI_QUEUE_NAME)

const knowledgeWorker = new Worker(
  KNOWLEDGE_QUEUE_NAME,
  async (job) => {
    await withJobTimeout(
      env.KNOWLEDGE_JOB_TIMEOUT_MS,
      async () => {
        if (job.name === KNOWLEDGE_JOB_NAMES.index) {
          await processKnowledgeIndexJob(job.data as KnowledgeIndexJobData)
          logger.info(`Knowledge index job processed: ${job.id ?? 'unknown'}`)
          return
        }

        if (job.name === KNOWLEDGE_JOB_NAMES.removeCatalogue) {
          await processKnowledgeRemoveCatalogueJob(job.data as KnowledgeRemoveCatalogueJobData)
          logger.info(`Knowledge remove job processed: ${job.id ?? 'unknown'}`)
          return
        }

        if (job.name === KNOWLEDGE_JOB_NAMES.refreshWebsite) {
          await processKnowledgeRefreshWebsiteJob()
          logger.info(`Knowledge website refresh job processed: ${job.id ?? 'unknown'}`)
          return
        }

        if (job.name === KNOWLEDGE_JOB_NAMES.refreshInstagram) {
          await processKnowledgeRefreshInstagramJob()
          logger.info(`Knowledge Instagram refresh job processed: ${job.id ?? 'unknown'}`)
          return
        }

        throw new Error(`Unhandled knowledge job type: ${job.name}`)
      },
      `Knowledge job timed out after ${env.KNOWLEDGE_JOB_TIMEOUT_MS}ms`,
    )
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: env.KNOWLEDGE_WORKER_CONCURRENCY,
  },
)

const agentWorker = new Worker(
  AGENT_QUEUE_NAME,
  async (job) => {
    await withJobTimeout(
      env.AGENT_JOB_TIMEOUT_MS,
      async () => {
        if (job.name === AGENT_JOB_NAMES.evaluate) {
          await processAgentEvaluateJob(job.data as AgentEvaluateJobData)
          logger.info(`Agent evaluate job processed: ${job.id ?? 'unknown'}`)
          return
        }

        throw new Error(`Unhandled agent job type: ${job.name}`)
      },
      `Agent job timed out after ${env.AGENT_JOB_TIMEOUT_MS}ms`,
    )
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: env.AGENT_WORKER_CONCURRENCY,
  },
)

attachWorkerLifecycleLogs(knowledgeWorker, KNOWLEDGE_QUEUE_NAME)
attachWorkerLifecycleLogs(agentWorker, AGENT_QUEUE_NAME)

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(`Shutting down worker (${signal})`)
  await webhookWorker.close()
  await mediaWorker.close()
  await aiWorker.close()
  await knowledgeWorker.close()
  await agentWorker.close()
  await closeWebhookQueue()
  await closeMediaQueue()
  await closeAiQueue()
  await closeKnowledgeQueue()
  await closeAgentQueue()
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
  `Workers started (webhooks: ${WEBHOOK_QUEUE_NAME} x${env.WEBHOOK_WORKER_CONCURRENCY}, media: ${MEDIA_QUEUE_NAME} x${env.MEDIA_WORKER_CONCURRENCY}, ai: ${AI_QUEUE_NAME} x${env.AI_WORKER_CONCURRENCY}, knowledge: ${KNOWLEDGE_QUEUE_NAME} x${env.KNOWLEDGE_WORKER_CONCURRENCY}, agent: ${AGENT_QUEUE_NAME} x${env.AGENT_WORKER_CONCURRENCY})`,
)

void registerKnowledgeScheduler().catch((error: unknown) => {
  logger.error(error)
})
