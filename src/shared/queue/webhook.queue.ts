import { Queue } from 'bullmq'

import { getRedisConnectionOptions } from '../redis/client.js'
import { webhookDefaultJobOptions } from './queue.options.js'

export const WEBHOOK_QUEUE_NAME = 'webhooks'

export const WEBHOOK_JOB_NAMES = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
} as const

export type WebhookJobData = {
  rawBodyBase64: string
  signatureHeader: string | undefined
  body: unknown
}

export type WhatsAppWebhookJobData = WebhookJobData

export type InstagramWebhookJobData = WebhookJobData

let webhookQueue: Queue | null = null

export function getWebhookQueue(): Queue {
  if (webhookQueue !== null) {
    return webhookQueue
  }

  webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: webhookDefaultJobOptions(),
  })

  return webhookQueue
}

function toWebhookJobData(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}): WhatsAppWebhookJobData {
  return {
    rawBodyBase64: input.rawBody.toString('base64'),
    signatureHeader: input.signatureHeader,
    body: input.body,
  }
}

export async function enqueueWhatsAppWebhookJob(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}) {
  const queue = getWebhookQueue()
  return queue.add(WEBHOOK_JOB_NAMES.whatsapp, toWebhookJobData(input))
}

export async function enqueueInstagramWebhookJob(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}) {
  const queue = getWebhookQueue()
  return queue.add(WEBHOOK_JOB_NAMES.instagram, toWebhookJobData(input))
}

export async function closeWebhookQueue(): Promise<void> {
  if (webhookQueue === null) {
    return
  }

  await webhookQueue.close()
  webhookQueue = null
}
