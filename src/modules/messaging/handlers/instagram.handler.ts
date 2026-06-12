import {
  parseInstagramInboundMessages,
  parseInstagramInboundReactions,
  parseInstagramOutboundReadReceipts,
} from '../../../platforms/instagram/parseWebhook.js'
import { verifyMetaWebhookSignature } from '../../../platforms/shared/webhookSignature.js'
import { verifyMetaWebhookChallenge, type WebhookVerifyQuery } from '../../../platforms/shared/webhookChallenge.js'
import { resolveInstagramParticipantPresentation } from '../../../platforms/instagram/enrichment.js'
import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { IntegrationCredentials } from '../../integrations/integrations.constants.js'
import { resolveInstagramIntegrationByBusinessId } from '../../integrations/credentials.service.js'
import {
  applyCustomerReaction,
  markOutboundMessageRead,
  receiveInboundMessage,
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
    } catch {
      continue
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
    } catch {
      continue
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
    } catch {
      continue
    }
  }
}
