import type { InstagramWebhookJobData, WhatsAppWebhookJobData } from '../../shared/queue/webhook.queue.js'
import { processInstagramWebhook } from './handlers/instagram.handler.js'
import { processWhatsAppWebhook } from './handlers/whatsapp.handler.js'

type WebhookHandlerInput = {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}

type WebhookJobData = WhatsAppWebhookJobData | InstagramWebhookJobData

function webhookJobDataToHandlerInput(data: WebhookJobData): WebhookHandlerInput {
  return {
    rawBody: Buffer.from(data.rawBodyBase64, 'base64'),
    signatureHeader: data.signatureHeader,
    body: data.body,
  }
}

export async function processWhatsAppWebhookJob(data: WhatsAppWebhookJobData): Promise<void> {
  await processWhatsAppWebhook(webhookJobDataToHandlerInput(data))
}

export async function processInstagramWebhookJob(data: InstagramWebhookJobData): Promise<void> {
  await processInstagramWebhook(webhookJobDataToHandlerInput(data))
}
