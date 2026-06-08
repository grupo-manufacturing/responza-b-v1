import type { WhatsAppInboundEvent } from '../../connectors/whatsapp/index.js'
import * as integrationsRepository from '../integrations/integrations.repository.js'
import { syncChannelsFromConnectedIntegrations } from './channels.service.js'
import * as inboxRepository from './inbox.repository.js'

async function resolveWhatsAppIntegration(event: WhatsAppInboundEvent) {
  const byPhone = await integrationsRepository.findConnectedWhatsAppByPhoneNumberId(
    event.phoneNumberId,
  )

  if (byPhone !== null) {
    return byPhone
  }

  if (event.wabaId !== null) {
    return integrationsRepository.findConnectedWhatsAppByWabaId(event.wabaId)
  }

  return null
}

export async function ingestWhatsAppInboundEvent(event: WhatsAppInboundEvent): Promise<boolean> {
  const existingMessage = await inboxRepository.findMessageByPlatformMessageId(event.platformMessageId)
  if (existingMessage !== null) {
    return false
  }

  const integration = await resolveWhatsAppIntegration(event)
  if (integration === null) {
    return false
  }

  await syncChannelsFromConnectedIntegrations(integration.organization_id)

  const channels = await inboxRepository.listChannelsByOrganization(integration.organization_id)
  const channel = channels.find((entry) => entry.integration_id === integration.id)

  if (channel === undefined) {
    return false
  }

  const conversation = await inboxRepository.findOrCreateConversation({
    organization_id: integration.organization_id,
    channel_id: channel.id,
    external_id: event.externalConversationId,
  })

  const participant = await inboxRepository.findOrCreateParticipant({
    conversation_id: conversation.id,
    platform_user_id: event.externalConversationId,
    display_name: event.displayName,
    metadata: {},
  })

  let message
  try {
    message = await inboxRepository.insertMessage({
      conversation_id: conversation.id,
      participant_id: participant.id,
      direction: 'inbound',
      content_type: event.contentType,
      body: event.body,
      status: 'delivered',
      platform_message_id: event.platformMessageId,
      metadata: event.metadata,
    })
  } catch {
    const duplicate = await inboxRepository.findMessageByPlatformMessageId(event.platformMessageId)
    if (duplicate !== null) {
      return false
    }

    throw new Error('Failed to ingest inbound WhatsApp message')
  }

  await inboxRepository.touchConversationAfterMessage(
    integration.organization_id,
    conversation.id,
    message.created_at,
    { incrementUnread: true },
  )

  return true
}
