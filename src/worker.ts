import { Worker } from 'bullmq'

import { loadEnv } from './shared/config/index.js'
import { processInstagramWebhookJob, processWhatsAppWebhookJob } from './modules/messaging/webhook.worker.js'
import { logger } from './shared/logger.js'
import {
  WEBHOOK_JOB_NAMES,
  WEBHOOK_QUEUE_NAME,
  type InstagramWebhookJobData,
  type WhatsAppWebhookJobData,
} from './shared/queue/webhook.queue.js'
import { closeRedisConnection, getRedisConnectionOptions } from './shared/redis/index.js'

loadEnv()

let shuttingDown = false

const worker = new Worker(
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

    throw new Error(`Unhandled job type: ${job.name}`)
  },
  {
    connection: getRedisConnectionOptions(),
    concurrency: 5,
  },
)

worker.on('failed', (job, error) => {
  logger.warn('Worker job failed', {
    jobId: job?.id ?? null,
    jobName: job?.name ?? null,
    error: error.message,
  })
})

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(`Shutting down worker (${signal})`)
  await worker.close()
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

logger.info('Webhook worker started')
