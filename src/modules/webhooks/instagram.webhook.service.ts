import { fetchInstagramParticipantProfile } from '../../connectors/instagram/instagram.connector.js'
import { parseInstagramInboundEvents } from '../../connectors/instagram/parseWebhook.js'
import { verifyMetaWebhookSignature } from '../../connectors/whatsapp/verifyWebhookSignature.js'
import { AppError } from '../../shared/errors/index.js'
import {
  resolveInstagramIntegrationForWebhook,
  updateInstagramMessagingAccountId,
} from '../integrations/integrations.service.js'
import type { InstagramIntegrationMetadata } from '../integrations/integrations.types.js'
import { receiveInboundMessage } from '../inbox/inbox.service.js'
import { resolveInstagramWebhookAppSecret } from './meta.webhook.shared.js'

function businessInstagramId(
  metadata: InstagramIntegrationMetadata,
  learnedMessagingAccountId: string | null,
): string | null {
  const messagingAccountId =
    learnedMessagingAccountId?.trim() || metadata.messaging_account_id?.trim() || ''
  if (messagingAccountId.length > 0) {
    return messagingAccountId
  }

  const igUserId = metadata.ig_user_id.trim()
  return igUserId.length > 0 ? igUserId : null
}

function learnedMessagingAccountIdFromEvent(input: {
  entryId: string | null
  recipientId: string | null
  igUserId: string
}): string | null {
  if (input.entryId !== null) {
    return input.entryId
  }

  if (
    input.recipientId !== null &&
    input.recipientId.length > 0 &&
    input.recipientId === input.igUserId
  ) {
    return input.recipientId
  }

  return null
}

function formatInstagramChannelDisplayName(metadata: InstagramIntegrationMetadata): string {
  const username = metadata.ig_username.trim()
  if (username.length > 0) {
    return username.startsWith('@') ? username : `@${username}`
  }

  return 'Instagram'
}

function formatInstagramParticipantDisplayName(
  senderId: string,
  profile: Awaited<ReturnType<typeof fetchInstagramParticipantProfile>>,
): string {
  if (profile !== null) {
    if (profile.username.length > 0) {
      return profile.username.startsWith('@') ? profile.username : `@${profile.username}`
    }

    if (profile.name !== null && profile.name.length > 0) {
      return profile.name
    }
  }

  return senderId
}

async function persistLearnedMessagingAccountId(input: {
  organizationId: string
  entryId: string | null
  recipientId: string | null
  igUserId: string
}): Promise<void> {
  if (input.entryId !== null) {
    await updateInstagramMessagingAccountId(input.organizationId, input.entryId)
    return
  }

  if (
    input.recipientId !== null &&
    input.recipientId.length > 0 &&
    input.recipientId === input.igUserId
  ) {
    await updateInstagramMessagingAccountId(input.organizationId, input.recipientId)
  }
}

export async function processInstagramWebhook(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  body: unknown
}): Promise<void> {
  const appSecret = resolveInstagramWebhookAppSecret()

  if (appSecret.length === 0) {
    throw new AppError(
      500,
      'INTERNAL_ERROR',
      'INSTAGRAM_APP_SECRET or META_APP_SECRET is not configured',
    )
  }

  if (!verifyMetaWebhookSignature(input.rawBody, input.signatureHeader, appSecret)) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid webhook signature')
  }

  const inboundEvents = parseInstagramInboundEvents(input.body)

  for (const inbound of inboundEvents) {
    try {
      const integration = await resolveInstagramIntegrationForWebhook({
        messagingAccountId: inbound.entryId,
        igUserId: inbound.recipientId ?? inbound.entryId,
      })

      if (integration === null) {
        continue
      }

      const learnedMessagingAccountId = learnedMessagingAccountIdFromEvent({
        entryId: inbound.entryId,
        recipientId: inbound.recipientId,
        igUserId: integration.metadata.ig_user_id,
      })

      await persistLearnedMessagingAccountId({
        organizationId: integration.organizationId,
        entryId: inbound.entryId,
        recipientId: inbound.recipientId,
        igUserId: integration.metadata.ig_user_id,
      })

      const businessId = businessInstagramId(integration.metadata, learnedMessagingAccountId)
      if (businessId !== null && inbound.senderId === businessId) {
        continue
      }

      const profile = await fetchInstagramParticipantProfile(
        inbound.senderId,
        integration.accessToken,
      )

      await receiveInboundMessage({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'instagram',
        channelDisplayName: formatInstagramChannelDisplayName(integration.metadata),
        conversationExternalId: inbound.senderId,
        participant: {
          platformUserId: inbound.senderId,
          displayName: formatInstagramParticipantDisplayName(inbound.senderId, profile),
        },
        message: {
          platformMessageId: inbound.platformMessageId,
          content: inbound.content,
        },
      })
    } catch {
      // Acknowledge webhook at HTTP layer; skip individual message failures.
    }
  }
}
