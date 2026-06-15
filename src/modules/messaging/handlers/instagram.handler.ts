import {
  parseInstagramInboundMessages,
  parseInstagramInboundReactions,
  parseInstagramOutboundEchoes,
  parseInstagramOutboundReadReceipts,
} from '../../../platforms/instagram/parseWebhook.js'
import { verifyMetaWebhookSignature } from '../../../platforms/shared/webhookSignature.js'
import { verifyMetaWebhookChallenge, type WebhookVerifyQuery } from '../../../platforms/shared/webhookChallenge.js'
import { resolveInstagramParticipantPresentation } from '../../../platforms/instagram/enrichment.js'
import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import { logger } from '../../../shared/logger.js'
import type { IntegrationCredentials } from '../../integrations/integrations.constants.js'
import { resolveInstagramIntegrationByBusinessId } from '../../integrations/credentials.service.js'
import {
  applyCustomerReaction,
  markOutboundMessageRead,
  receiveInboundMessage,
  receiveOutboundEcho,
} from '../../inbox/inbox.service.js'

function formatInstagramDisplayName(igsid: string, contactName: string | null): string {
  if (contactName !== null) {
    return contactName
  }

  return igsid.startsWith('@') ? igsid : `@${igsid}`
}

async function resolveIntegrationForInbound(input: {
  businessAccountId: string | null
}): Promise<IntegrationCredentials | null> {
  if (input.businessAccountId !== null) {
    return resolveInstagramIntegrationByBusinessId(input.businessAccountId)
  }

  return null
}

export function verifyInstagramWebhookChallenge(query: WebhookVerifyQuery): string {
  const { WEBHOOK_VERIFY_TOKEN } = loadEnv()
  return verifyMetaWebhookChallenge(query, WEBHOOK_VERIFY_TOKEN)
}

export async function processInstagramWebhook(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}): Promise<void> {
  const { INSTAGRAM_APP_SECRET } = loadEnv()

  if (INSTAGRAM_APP_SECRET.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'INSTAGRAM_APP_SECRET is not configured')
  }

  if (!verifyMetaWebhookSignature(input.rawBody, input.signatureHeader, INSTAGRAM_APP_SECRET, 'sha1')) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid webhook signature')
  }

  const inboundMessages = parseInstagramInboundMessages(input.body)
  const outboundEchoes = parseInstagramOutboundEchoes(input.body)
  const readReceipts = parseInstagramOutboundReadReceipts(input.body)
  const inboundReactions = parseInstagramInboundReactions(input.body)

  for (const reaction of inboundReactions) {
    try {
      const integration = await resolveIntegrationForInbound({
        businessAccountId: reaction.businessAccountId,
      })

      if (integration === null) {
        continue
      }

      await applyCustomerReaction({
        organizationId: integration.organizationId,
        platformMessageId: reaction.targetPlatformMessageId,
        emoji: reaction.emoji,
      })
    } catch (error) {
      logger.warn('Instagram inbound reaction webhook failed', {
        platformMessageId: reaction.targetPlatformMessageId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const receipt of readReceipts) {
    try {
      const integration = await resolveIntegrationForInbound({
        businessAccountId: receipt.businessAccountId,
      })

      if (integration === null) {
        continue
      }

      await markOutboundMessageRead({
        organizationId: integration.organizationId,
        platformMessageId: receipt.platformMessageId,
      })
    } catch (error) {
      logger.warn('Instagram read receipt webhook failed', {
        platformMessageId: receipt.platformMessageId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const echo of outboundEchoes) {
    try {
      const integration = await resolveIntegrationForInbound({
        businessAccountId: echo.businessAccountId,
      })

      if (integration === null) {
        continue
      }

      const fallbackDisplayName = formatInstagramDisplayName(echo.to, null)
      const presentation = await resolveInstagramParticipantPresentation({
        platformUserId: echo.to,
        accessToken: integration.accessToken,
        fallbackDisplayName,
      })

      await receiveOutboundEcho({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'instagram',
        channelDisplayName: 'Instagram',
        conversationExternalId: echo.to,
        participant: {
          platformUserId: echo.to,
          displayName: presentation.displayName,
          avatarUrl: presentation.avatarUrl,
        },
        message: {
          platformMessageId: echo.platformMessageId,
          content: echo.content,
        },
      })
    } catch (error) {
      logger.warn('Instagram outbound echo webhook failed', {
        platformMessageId: echo.platformMessageId,
        recipientId: echo.to,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  for (const inbound of inboundMessages) {
    try {
      const integration = await resolveIntegrationForInbound({
        businessAccountId: inbound.businessAccountId,
      })

      if (integration === null) {
        continue
      }

      const fallbackDisplayName = formatInstagramDisplayName(
        inbound.from,
        inbound.contactDisplayName,
      )
      const presentation = await resolveInstagramParticipantPresentation({
        platformUserId: inbound.from,
        accessToken: integration.accessToken,
        fallbackDisplayName,
      })

      await receiveInboundMessage({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'instagram',
        channelDisplayName: 'Instagram',
        conversationExternalId: inbound.from,
        participant: {
          platformUserId: inbound.from,
          displayName: presentation.displayName,
          avatarUrl: presentation.avatarUrl,
        },
        message: {
          platformMessageId: inbound.platformMessageId,
          content: inbound.content,
        },
      })
    } catch (error) {
      logger.warn('Instagram inbound message webhook failed', {
        platformMessageId: inbound.platformMessageId,
        senderId: inbound.from,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
