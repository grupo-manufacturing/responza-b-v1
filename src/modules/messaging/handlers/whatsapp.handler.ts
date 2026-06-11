import { parseWhatsAppInboundMessages } from '../../../platforms/whatsapp/parseWebhook.js'
import { verifyMetaWebhookSignature } from '../../../platforms/shared/webhookSignature.js'
import { verifyMetaWebhookChallenge, type WebhookVerifyQuery } from '../../../platforms/shared/webhookChallenge.js'
import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { IntegrationCredentials } from '../../integrations/integrations.constants.js'
import {
  resolveWhatsAppIntegrationByPhoneNumberId,
  resolveWhatsAppIntegrationByWabaId,
} from '../../integrations/credentials.service.js'
import { receiveInboundMessage } from '../../inbox/inbox.service.js'

function formatWhatsAppDisplayName(waId: string, contactName: string | null): string {
  if (contactName !== null) {
    return contactName
  }

  const digits = waId.replace(/\D/g, '')
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`
  }

  return waId
}

async function resolveIntegrationForInbound(input: {
  phoneNumberId: string | null
  wabaId: string | null
}): Promise<IntegrationCredentials | null> {
  if (input.phoneNumberId !== null) {
    const byPhone = await resolveWhatsAppIntegrationByPhoneNumberId(input.phoneNumberId)
    if (byPhone !== null) {
      return byPhone
    }
  }

  if (input.wabaId !== null) {
    return resolveWhatsAppIntegrationByWabaId(input.wabaId)
  }

  return null
}

export function verifyWhatsAppWebhookChallenge(query: WebhookVerifyQuery): string {
  const { WEBHOOK_VERIFY_TOKEN } = loadEnv()
  return verifyMetaWebhookChallenge(query, WEBHOOK_VERIFY_TOKEN)
}

export async function processWhatsAppWebhook(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}): Promise<void> {
  const { META_APP_SECRET } = loadEnv()

  if (META_APP_SECRET.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'META_APP_SECRET is not configured')
  }

  if (!verifyMetaWebhookSignature(input.rawBody, input.signatureHeader, META_APP_SECRET, 'sha256')) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid webhook signature')
  }

  const inboundMessages = parseWhatsAppInboundMessages(input.body)

  for (const inbound of inboundMessages) {
    try {
      const integration = await resolveIntegrationForInbound({
        phoneNumberId: inbound.phoneNumberId,
        wabaId: inbound.wabaId,
      })

      if (integration === null) {
        continue
      }

      await receiveInboundMessage({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'whatsapp',
        channelDisplayName: inbound.channelDisplayName ?? 'WhatsApp',
        conversationExternalId: inbound.from,
        participant: {
          platformUserId: inbound.from,
          displayName: formatWhatsAppDisplayName(inbound.from, inbound.contactDisplayName),
        },
        message: {
          platformMessageId: inbound.platformMessageId,
          content: inbound.content,
        },
      })
    } catch {
      continue
    }
  }
}
