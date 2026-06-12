import { AppError } from '../shared/errors/index.js'
import {
  getInstagramCredentialsForOrganization,
  getWhatsAppCredentialsForOrganization,
} from '../modules/integrations/credentials.service.js'
import type {
  InstagramIntegrationMetadata,
  IntegrationPlatform,
  WhatsAppIntegrationMetadata,
} from '../modules/integrations/integrations.constants.js'
import { sendInstagramReaction } from './instagram/instagram.connector.js'
import { sendWhatsAppReaction } from './whatsapp/whatsapp.connector.js'

export type OutboundReactionInput = {
  platform: IntegrationPlatform
  organizationId: string
  integrationId: string
  recipientExternalId: string
  targetPlatformMessageId: string
  emoji: string | null
}

export async function dispatchOutboundReaction(input: OutboundReactionInput): Promise<void> {
  switch (input.platform) {
    case 'whatsapp':
      return dispatchWhatsAppReaction(input)
    case 'instagram':
      return dispatchInstagramReaction(input)
    case 'indiamart':
      return
    default:
      throw new AppError(400, 'BAD_REQUEST', `Unsupported platform: ${input.platform}`)
  }
}

async function dispatchWhatsAppReaction(input: OutboundReactionInput): Promise<void> {
  const credentials = await getWhatsAppCredentialsForOrganization(input.organizationId)

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Connect WhatsApp before reacting to messages')
  }

  if (credentials.integrationId !== input.integrationId) {
    throw new AppError(400, 'BAD_REQUEST', 'Conversation channel is not linked to WhatsApp')
  }

  await sendWhatsAppReaction({
    to: input.recipientExternalId,
    messageId: input.targetPlatformMessageId,
    emoji: input.emoji,
    phoneNumberId: (credentials.metadata as WhatsAppIntegrationMetadata).phone_number_id,
    accessToken: credentials.accessToken,
  })
}

async function dispatchInstagramReaction(input: OutboundReactionInput): Promise<void> {
  const credentials = await getInstagramCredentialsForOrganization(input.organizationId)

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Connect Instagram before reacting to messages')
  }

  if (credentials.integrationId !== input.integrationId) {
    throw new AppError(400, 'BAD_REQUEST', 'Conversation channel is not linked to Instagram')
  }

  await sendInstagramReaction({
    to: input.recipientExternalId,
    messageId: input.targetPlatformMessageId,
    emoji: input.emoji,
    businessAccountId: (credentials.metadata as InstagramIntegrationMetadata).business_account_id,
    accessToken: credentials.accessToken,
  })
}
