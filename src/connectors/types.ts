export type MessageContentType = 'text' | 'image' | 'video' | 'audio' | 'document'

export type MessageDirection = 'inbound' | 'outbound'

export type IncomingMessage = {
  platformMessageId: string
  externalConversationId: string
  participant: ParticipantProfile
  direction: MessageDirection
  contentType: MessageContentType
  body: string | null
  fileUrl: string | null
  metadata: Record<string, unknown>
  sentAt: string
}

export type OutboundMessage = {
  externalConversationId: string
  contentType: MessageContentType
  body: string | null
  fileUrl: string | null
  metadata?: Record<string, unknown>
}

export type ParticipantProfile = {
  platformUserId: string
  displayName: string | null
  avatarUrl: string | null
  metadata?: Record<string, unknown>
}
