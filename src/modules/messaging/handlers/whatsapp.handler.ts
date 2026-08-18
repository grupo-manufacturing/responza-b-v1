import {
  parseWhatsAppInboundMessages,
  parseWhatsAppOutboundEchoes,
  parseWhatsAppOutboundReadReceipts,
} from '../../../platforms/whatsapp/parseWebhook.js'
import { verifyMetaWebhookSignature } from '../../../platforms/shared/webhookSignature.js'
import { verifyMetaWebhookChallenge, type WebhookVerifyQuery } from '../../../platforms/shared/webhookChallenge.js'
import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import { logger } from '../../../shared/logger.js'
import type { IntegrationCredentials } from '../../integrations/integrations.constants.js'
import {
  resolveWhatsAppIntegrationByPhoneNumberId,
  resolveWhatsAppIntegrationByWabaId,
} from '../../integrations/credentials.service.js'
import {
  markOutboundMessageRead,
  receiveInboundMessage,
  receiveOutboundEcho,
} from '../../inbox/inbox.service.js'

type WhatsAppWebhookRouting = {
  phoneNumberId: string | null
  wabaId: string | null
}

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

function buildWhatsAppParticipant(waId: string, contactDisplayName: string | null) {
  return {
    platformUserId: waId,
    displayName: formatWhatsAppDisplayName(waId, contactDisplayName),
  }
}

async function resolveIntegrationForInbound(
  input: WhatsAppWebhookRouting,
): Promise<IntegrationCredentials | null> {
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

async function processWhatsAppWebhookItems<T extends WhatsAppWebhookRouting>(
  items: T[],
  logLabel: string,
  logContext: (item: T) => Record<string, unknown>,
  handler: (item: T, integration: IntegrationCredentials) => Promise<void>,
): Promise<void> {
  for (const item of items) {
    try {
      const integration = await resolveIntegrationForInbound(item)

      if (integration === null) {
        continue
      }

      await handler(item, integration)
    } catch (error) {
      logger.warn(logLabel, {
        ...logContext(item),
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export function verifyWhatsAppWebhookChallenge(query: WebhookVerifyQuery): string {
  const { WEBHOOK_VERIFY_TOKEN } = loadEnv()
  return verifyMetaWebhookChallenge(query, WEBHOOK_VERIFY_TOKEN)
}

export function assertWhatsAppWebhookSignature(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
}): void {
  const { META_APP_SECRET } = loadEnv()

  if (META_APP_SECRET.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'META_APP_SECRET is not configured')
  }

  if (!verifyMetaWebhookSignature(input.rawBody, input.signatureHeader, META_APP_SECRET, 'sha256')) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid webhook signature')
  }
}

export async function processWhatsAppWebhook(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}): Promise<void> {
  assertWhatsAppWebhookSignature(input)

  const inboundMessages = parseWhatsAppInboundMessages(input.body)
  const outboundEchoes = parseWhatsAppOutboundEchoes(input.body)
  const readReceipts = parseWhatsAppOutboundReadReceipts(input.body)

  await processWhatsAppWebhookItems(
    readReceipts,
    'WhatsApp read receipt webhook failed',
    (receipt) => ({ platformMessageId: receipt.platformMessageId }),
    async (receipt, integration) => {
      await markOutboundMessageRead({
        organizationId: integration.organizationId,
        platformMessageId: receipt.platformMessageId,
      })
    },
  )

  await processWhatsAppWebhookItems(
    outboundEchoes,
    'WhatsApp outbound echo webhook failed',
    (echo) => ({
      platformMessageId: echo.platformMessageId,
      recipientId: echo.to,
    }),
    async (echo, integration) => {
      await receiveOutboundEcho({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'whatsapp',
        channelDisplayName: echo.channelDisplayName ?? 'WhatsApp',
        conversationExternalId: echo.to,
        participant: buildWhatsAppParticipant(echo.to, echo.contactDisplayName),
        message: {
          platformMessageId: echo.platformMessageId,
          content: echo.content,
        },
      })
    },
  )

  await processWhatsAppWebhookItems(
    inboundMessages,
    'WhatsApp inbound message webhook failed',
    (inbound) => ({
      platformMessageId: inbound.platformMessageId,
      senderId: inbound.from,
    }),
    async (inbound, integration) => {
      await receiveInboundMessage({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'whatsapp',
        channelDisplayName: inbound.channelDisplayName ?? 'WhatsApp',
        conversationExternalId: inbound.from,
        participant: buildWhatsAppParticipant(inbound.from, inbound.contactDisplayName),
        accessToken: integration.accessToken,
        message: {
          platformMessageId: inbound.platformMessageId,
          content: inbound.content,
          contentType: inbound.contentType,
          media:
            inbound.media !== undefined
              ? {
                  platformMediaId: inbound.media.id,
                  mimeType: inbound.media.mimeType,
                  filename: inbound.media.filename,
                }
              : undefined,
        },
      })
    },
  )
}
