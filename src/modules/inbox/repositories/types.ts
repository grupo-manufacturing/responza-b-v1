import type { IntegrationPlatform } from '../../integrations/integrations.constants.js'
import type { MessageDirection, MessageStatus, MessageContentType } from '../inbox.schemas.js'

export type ChannelRecord = {
  id: string
  organization_id: string
  integration_id: string
  platform: IntegrationPlatform
  display_name: string
  created_at: string
}

export type ConversationRecord = {
  id: string
  organization_id: string
  channel_id: string
  external_id: string
  last_message_at: string
  created_at: string
}

export type ConversationSendContext = ConversationRecord & {
  platform: IntegrationPlatform
  integration_id: string
}

export type ConversationListRecord = ConversationRecord & {
  platform: IntegrationPlatform
  channel_display_name: string
  contact_participant_id: string | null
  contact_platform_user_id: string | null
  contact_display_name: string | null
  contact_avatar_url: string | null
  last_message_content: string | null
}

export type ParticipantRecord = {
  id: string
  organization_id: string
  conversation_id: string
  platform_user_id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export type MessageRecord = {
  id: string
  organization_id: string
  conversation_id: string
  participant_id: string | null
  direction: MessageDirection
  platform_message_id: string | null
  content: string
  content_type: MessageContentType
  storage_path: string | null
  mime_type: string | null
  platform_media_id: string | null
  file_size_bytes: number | null
  status: MessageStatus
  send_source: 'human' | 'agent'
  created_at: string
}

export type ListConversationsInput = {
  organizationId: string
  platform?: IntegrationPlatform
  limit?: number
  cursor?: string
}

export type ListConversationsResult = {
  conversations: ConversationListRecord[]
  nextCursor: string | null
  hasMore: boolean
}

export type ListMessagesInput = {
  organization_id: string
  conversation_id: string
  limit: number
  before?: string
}

export type ListMessagesResult = {
  messages: MessageRecord[]
  nextCursor: string | null
  hasMore: boolean
}
