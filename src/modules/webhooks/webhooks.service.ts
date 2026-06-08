import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import {
  parseWhatsAppWebhookPayload,
  verifyWhatsAppWebhookSignature,
} from '../../connectors/whatsapp/index.js'
import { ingestWhatsAppInboundEvent } from '../inbox/inbound-ingest.service.js'

export function verifyWhatsAppWebhookChallenge(query: Record<string, unknown>): string | null {
  const env = loadEnv()
  const mode = typeof query['hub.mode'] === 'string' ? query['hub.mode'] : ''
  const token = typeof query['hub.verify_token'] === 'string' ? query['hub.verify_token'] : ''
  const challenge = typeof query['hub.challenge'] === 'string' ? query['hub.challenge'] : ''

  if (mode !== 'subscribe' || token.length === 0 || challenge.length === 0) {
    return null
  }

  if (token !== env.WEBHOOK_VERIFY_TOKEN) {
    return null
  }

  return challenge
}

export async function handleWhatsAppWebhook(
  signatureHeader: string | undefined,
  rawBody: string,
  payload: unknown,
): Promise<{ processed: number; skipped: number }> {
  if (signatureHeader === undefined || rawBody.length === 0) {
    throw new AppError(401, 'UNAUTHORIZED', 'Missing WhatsApp webhook signature')
  }

  if (!verifyWhatsAppWebhookSignature(signatureHeader, rawBody)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid WhatsApp webhook signature')
  }

  const events = parseWhatsAppWebhookPayload(payload)
  let processed = 0
  let skipped = 0

  for (const event of events) {
    const ingested = await ingestWhatsAppInboundEvent(event)
    if (ingested) {
      processed += 1
    } else {
      skipped += 1
    }
  }

  return { processed, skipped }
}
