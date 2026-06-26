import {
  enqueueInstagramWebhookJob,
  enqueueWhatsAppWebhookJob,
} from '../../shared/queue/index.js'
import { assertInstagramWebhookSignature } from './handlers/instagram.handler.js'
import { assertWhatsAppWebhookSignature } from './handlers/whatsapp.handler.js'

type WebhookEnqueueInput = {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}

export async function enqueueWhatsAppWebhook(input: WebhookEnqueueInput): Promise<void> {
  assertWhatsAppWebhookSignature(input)
  await enqueueWhatsAppWebhookJob(input)
}

export async function enqueueInstagramWebhook(input: WebhookEnqueueInput): Promise<void> {
  assertInstagramWebhookSignature(input)
  await enqueueInstagramWebhookJob(input)
}
