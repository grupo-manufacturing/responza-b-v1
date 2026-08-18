import {
  parseInstagramInboundMessages,
  parseInstagramOutboundEchoes,
  parseInstagramOutboundReadReceipts,
} from '../../../platforms/instagram/parseWebhook.js'
import { verifyMetaWebhookSignature } from '../../../platforms/shared/webhookSignature.js'
import { verifyMetaWebhookChallenge, type WebhookVerifyQuery } from '../../../platforms/shared/webhookChallenge.js'
import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import { logger } from '../../../shared/logger.js'
import type { IntegrationCredentials } from '../../integrations/integrations.constants.js'
import { resolveInstagramIntegrationByBusinessId } from '../../integrations/credentials.service.js'
import {
  markOutboundMessageRead,
  receiveInboundMessage,
  receiveOutboundEcho,
} from '../../inbox/inbox.service.js'

type InstagramWebhookRouting = {
  businessAccountId: string | null
}

function formatInstagramDisplayName(igsid: string, contactName: string | null): string {
  if (contactName !== null) {
    return contactName
  }

  return igsid.startsWith('@') ? igsid : `@${igsid}`
}

function buildInstagramParticipant(igsid: string, contactDisplayName: string | null) {
  return {
    platformUserId: igsid,
    displayName: formatInstagramDisplayName(igsid, contactDisplayName),
    avatarUrl: null as string | null,
  }
}

async function resolveIntegrationForInbound(
  input: InstagramWebhookRouting,
): Promise<IntegrationCredentials | null> {
  if (input.businessAccountId !== null) {
    return resolveInstagramIntegrationByBusinessId(input.businessAccountId)
  }

  return null
}

async function processInstagramWebhookItems<T extends InstagramWebhookRouting>(
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

export function verifyInstagramWebhookChallenge(query: WebhookVerifyQuery): string {
  const { WEBHOOK_VERIFY_TOKEN } = loadEnv()
  return verifyMetaWebhookChallenge(query, WEBHOOK_VERIFY_TOKEN)
}

export function assertInstagramWebhookSignature(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
}): void {
  const { INSTAGRAM_APP_SECRET } = loadEnv()

  if (INSTAGRAM_APP_SECRET.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'INSTAGRAM_APP_SECRET is not configured')
  }

  if (!verifyMetaWebhookSignature(input.rawBody, input.signatureHeader, INSTAGRAM_APP_SECRET, 'sha1')) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid webhook signature')
  }
}

export async function processInstagramWebhook(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}): Promise<void> {
  assertInstagramWebhookSignature(input)

  const inboundMessages = parseInstagramInboundMessages(input.body)
  const outboundEchoes = parseInstagramOutboundEchoes(input.body)
  const readReceipts = parseInstagramOutboundReadReceipts(input.body)

  await processInstagramWebhookItems(
    readReceipts,
    'Instagram read receipt webhook failed',
    (receipt) => ({ platformMessageId: receipt.platformMessageId }),
    async (receipt, integration) => {
      await markOutboundMessageRead({
        organizationId: integration.organizationId,
        platformMessageId: receipt.platformMessageId,
      })
    },
  )

  await processInstagramWebhookItems(
    outboundEchoes,
    'Instagram outbound echo webhook failed',
    (echo) => ({
      platformMessageId: echo.platformMessageId,
      recipientId: echo.to,
    }),
    async (echo, integration) => {
      await receiveOutboundEcho({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'instagram',
        channelDisplayName: 'Instagram',
        conversationExternalId: echo.to,
        participant: buildInstagramParticipant(echo.to, null),
        message: {
          platformMessageId: echo.platformMessageId,
          content: echo.content,
        },
      })
    },
  )

  await processInstagramWebhookItems(
    inboundMessages,
    'Instagram inbound message webhook failed',
    (inbound) => ({
      platformMessageId: inbound.platformMessageId,
      senderId: inbound.from,
    }),
    async (inbound, integration) => {
      await receiveInboundMessage({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'instagram',
        channelDisplayName: 'Instagram',
        conversationExternalId: inbound.from,
        participant: buildInstagramParticipant(inbound.from, inbound.contactDisplayName),
        accessToken: integration.accessToken,
        message: {
          platformMessageId: inbound.platformMessageId,
          content: inbound.content,
          contentType: inbound.contentType,
          media:
            inbound.media !== undefined
              ? {
                  mediaUrl: inbound.media.url,
                  mimeType: inbound.media.mimeType,
                }
              : undefined,
        },
      })
    },
  )
}
