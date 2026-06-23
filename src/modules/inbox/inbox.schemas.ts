import { z } from 'zod'

import { SUPPORTED_PLATFORMS } from '../integrations/integrations.constants.js'

export const MESSAGE_DIRECTION_VALUES = ['inbound', 'outbound'] as const
export const MESSAGE_STATUS_VALUES = ['pending', 'sent', 'failed', 'read'] as const
export const MESSAGE_CONTENT_TYPE_VALUES = ['text', 'image', 'video', 'audio', 'document'] as const
export const MESSAGE_QUICK_EMOJIS = [
  '😀',
  '😂',
  '❤️',
  '👍',
  '🙏',
  '🎉',
  '🔥',
  '✨',
  '😊',
  '😍',
  '🤔',
  '👋',
] as const

export type MessageDirection = (typeof MESSAGE_DIRECTION_VALUES)[number]
export type MessageStatus = (typeof MESSAGE_STATUS_VALUES)[number]
export type MessageContentType = (typeof MESSAGE_CONTENT_TYPE_VALUES)[number]
export type MessageQuickEmoji = (typeof MESSAGE_QUICK_EMOJIS)[number]

const messageReactionEmojiSchema = z.enum(MESSAGE_QUICK_EMOJIS)

export function isAllowedReactionEmoji(value: string): value is MessageQuickEmoji {
  return (MESSAGE_QUICK_EMOJIS as readonly string[]).includes(value)
}

const apiPlatformSchema = z.enum(SUPPORTED_PLATFORMS)
const contentSchema = z.string().trim().min(1).max(10000)

const DIRECTION_TO_API: Record<MessageDirection, string> = {
  inbound: 'inbound',
  outbound: 'outbound',
}

const STATUS_TO_API: Record<MessageStatus, string> = {
  pending: 'pending',
  sent: 'sent',
  failed: 'failed',
  read: 'read',
}

const CONTENT_TYPE_TO_API: Record<MessageContentType, string> = {
  text: 'text',
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'document',
}

export function messageContentTypeToApi(contentType: MessageContentType): string {
  return CONTENT_TYPE_TO_API[contentType]
}

export function messageDirectionToApi(direction: MessageDirection): string {
  return DIRECTION_TO_API[direction]
}

export function messageStatusToApi(status: MessageStatus): string {
  return STATUS_TO_API[status]
}

export const listInboxQuerySchema = z.object({
  platform: apiPlatformSchema.optional(),
})

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const reactMessageParamsSchema = conversationIdParamsSchema.extend({
  messageId: z.string().uuid(),
})

export const sendMessageBodySchema = z.object({
  content: contentSchema,
})

export const reactToMessageBodySchema = z.object({
  emoji: messageReactionEmojiSchema.nullable(),
})

export type ListInboxQuery = z.infer<typeof listInboxQuerySchema>
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>
export type ReactToMessageBody = z.infer<typeof reactToMessageBodySchema>
