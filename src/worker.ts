import { Worker } from 'bullmq'

import { loadEnv } from './shared/config/index.js'
import { processInboundMediaIngestionJob } from './modules/media/media.ingestion.worker.js'
import { processInstagramWebhookJob, processWhatsAppWebhookJob } from './modules/messaging/webhook.worker.js'
import { logger } from './shared/logger.js'
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
import { closeRedisConnection, getRedisConnectionOptions } from './shared/redis/index.js'

const env = loadEnv()

let shuttingDown = false

const webhookWorker = new Worker(
  WEBHOOK_QUEUE_NAME,
  async (job) => {
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
  {
    connection: getRedisConnectionOptions(),
    concurrency: env.WEBHOOK_WORKER_CONCURRENCY,
  },
)

const mediaWorker = new Worker(
  MEDIA_QUEUE_NAME,
  async (job) => {
    if (job.name === MEDIA_JOB_NAMES.ingest) {
      await processInboundMediaIngestionJob(job.data as InboundMediaIngestionJobData)
      logger.info(`Media ingestion job processed: ${job.id ?? 'unknown'}`)
      return
    }

    throw new Error(`Unhandled media job type: ${job.name}`)
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: env.MEDIA_WORKER_CONCURRENCY,
  },
)

function attachWorkerFailureLogs(worker: Worker, queueName: string): void {
  worker.on('failed', (job, error) => {
    logger.warn('Worker job failed', {
      queue: queueName,
      jobId: job?.id ?? null,
      jobName: job?.name ?? null,
      error: error.message,
    })
  })
}

attachWorkerFailureLogs(webhookWorker, WEBHOOK_QUEUE_NAME)
attachWorkerFailureLogs(mediaWorker, MEDIA_QUEUE_NAME)

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(`Shutting down worker (${signal})`)
  await webhookWorker.close()
  await mediaWorker.close()
  await closeWebhookQueue()
  await closeMediaQueue()
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
  `Workers started (webhooks: ${WEBHOOK_QUEUE_NAME} x${env.WEBHOOK_WORKER_CONCURRENCY}, media: ${MEDIA_QUEUE_NAME} x${env.MEDIA_WORKER_CONCURRENCY})`,
)
