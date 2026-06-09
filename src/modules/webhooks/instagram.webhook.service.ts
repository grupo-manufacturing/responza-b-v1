import { parseInstagramInboundMessages } from '../../connectors/instagram/parseWebhook.js'
import { verifyInstagramWebhookSignature } from '../../connectors/instagram/verifyWebhookSignature.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import {
  resolveInstagramIntegrationByBusinessId,
} from '../integrations/integrations.service.js'
import { receiveInboundMessage } from '../inbox/inbox.service.js'
import type { IntegrationCredentials } from '../integrations/integrations.types.js'

type WebhookVerifyQuery = {
  mode?: string
  token?: string
  challenge?: string
}

function formatInstagramDisplayName(igsid: string, contactName: string | null): string {
  if (contactName !== null) {
    return contactName
  }

  // For Instagram, we just return the IGSID as-is since we don't have a phone number format
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

  if (WEBHOOK_VERIFY_TOKEN.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'WEBHOOK_VERIFY_TOKEN is not configured')
  }

  const mode = query.mode
  const token = query.token
  const challenge = query.challenge

  if (mode !== 'subscribe' || token !== WEBHOOK_VERIFY_TOKEN || challenge === undefined) {
    throw new AppError(403, 'FORBIDDEN', 'Webhook verification failed')
  }

  return challenge
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

  if (!verifyInstagramWebhookSignature(input.rawBody, input.signatureHeader, INSTAGRAM_APP_SECRET)) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid webhook signature')
  }

  const inboundMessages = parseInstagramInboundMessages(input.body)

  for (const inbound of inboundMessages) {
    try {
      const integration = await resolveIntegrationForInbound({
        businessAccountId: inbound.businessAccountId,
      })

      if (integration === null) {
        continue
      }

      await receiveInboundMessage({
        organizationId: integration.organizationId,
        integrationId: integration.integrationId,
        platform: 'instagram',
        channelDisplayName: inbound.businessAccountId ? 'Instagram' : 'Instagram',
        conversationExternalId: inbound.from,
        participant: {
          platformUserId: inbound.from,
          displayName: formatInstagramDisplayName(inbound.from, inbound.contactDisplayName),
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