export const INBOX_PLATFORMS = ['whatsapp', 'instagram', 'indiamart'] as const

export type InboxPlatform = (typeof INBOX_PLATFORMS)[number]

export const MESSAGE_DIRECTION_VALUES = ['inbound', 'outbound'] as const

export type MessageDirection = (typeof MESSAGE_DIRECTION_VALUES)[number]

export const MESSAGE_CONTENT_TYPE_VALUES = [
  'text',
  'image',
  'video',
  'audio',
  'document',
] as const

export type MessageContentType = (typeof MESSAGE_CONTENT_TYPE_VALUES)[number]

export const MESSAGE_STATUS_VALUES = ['pending', 'sent', 'delivered', 'failed', 'read'] as const

export type MessageStatus = (typeof MESSAGE_STATUS_VALUES)[number]

const MESSAGE_DIRECTION_TO_API: Record<MessageDirection, string> = {
  inbound: 'inbound',
  outbound: 'outbound',
}

const MESSAGE_CONTENT_TYPE_TO_API: Record<MessageContentType, string> = {
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'document',
}

const MESSAGE_CONTENT_TYPE_FROM_API: Record<string, MessageContentType> = {
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'document',
}

const MESSAGE_STATUS_TO_API: Record<MessageStatus, string> = {
  pending: 'pending',
  sent: 'sent',
  delivered: 'delivered',
  failed: 'failed',
  read: 'read',
}

export function isInboxPlatform(value: string): value is InboxPlatform {
  return (INBOX_PLATFORMS as readonly string[]).includes(value)
}

export function messageDirectionToApi(direction: MessageDirection): string {
  return MESSAGE_DIRECTION_TO_API[direction]
}

export function messageContentTypeToApi(contentType: MessageContentType): string {
  return MESSAGE_CONTENT_TYPE_TO_API[contentType]
}

export function messageContentTypeFromApi(contentType: string): MessageContentType {
  const mapped = MESSAGE_CONTENT_TYPE_FROM_API[contentType]
  if (mapped === undefined) {
    throw new Error(`Invalid message content type: ${contentType}`)
  }

  return mapped
}

export function messageStatusToApi(status: MessageStatus): string {
  return MESSAGE_STATUS_TO_API[status]
}

export function defaultChannelDisplayName(platform: InboxPlatform): string {
  const labels: Record<InboxPlatform, string> = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    indiamart: 'IndiaMART',
  }

  return labels[platform]
}
