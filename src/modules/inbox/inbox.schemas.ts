import { z } from 'zod'

import { SUPPORTED_PLATFORMS } from '../integrations/integrations.constants.js'

export const MESSAGE_DIRECTION_VALUES = ['inbound', 'outbound'] as const
export const MESSAGE_STATUS_VALUES = ['pending', 'sent', 'failed', 'read'] as const
export const MESSAGE_CONTENT_TYPE_VALUES = ['text', 'image', 'video', 'audio', 'document'] as const

export type MessageDirection = (typeof MESSAGE_DIRECTION_VALUES)[number]
export type MessageStatus = (typeof MESSAGE_STATUS_VALUES)[number]
export type MessageContentType = (typeof MESSAGE_CONTENT_TYPE_VALUES)[number]
type MediaContentType = Exclude<MessageContentType, 'text'>

const MEDIA_CONTENT_TYPES = new Set<MessageContentType>(['image', 'video', 'audio', 'document'])

export function isMediaContentType(
  contentType: MessageContentType,
): contentType is MediaContentType {
  return MEDIA_CONTENT_TYPES.has(contentType)
}

const apiPlatformSchema = z.enum(SUPPORTED_PLATFORMS)
const captionSchema = z.string().trim().max(10000)
const mediaContentTypeSchema = z.enum(['image', 'video', 'audio', 'document'])

export const sendMessageBodySchema = z
  .object({
    content: captionSchema.optional(),
    contentType: z.enum(MESSAGE_CONTENT_TYPE_VALUES).default('text'),
    storagePath: z.string().trim().min(1).optional(),
    mimeType: z.string().trim().min(1).optional(),
    fileSizeBytes: z.number().int().positive().max(2 * 1024 * 1024).optional(),
    filename: z.string().trim().max(255).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.contentType === 'text') {
      if (body.content === undefined || body.content.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Content is required for text messages',
          path: ['content'],
        })
      }
      return
    }

    if (body.storagePath === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'storagePath is required for media messages',
        path: ['storagePath'],
      })
    }

    if (body.mimeType === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mimeType is required for media messages',
        path: ['mimeType'],
      })
    }
  })

export const uploadOutboundMediaFieldsSchema = z.object({
  contentType: mediaContentTypeSchema,
  filename: z.string().trim().max(255).optional(),
})

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
  limit: z.coerce.number().int().positive().max(100).optional(),
  cursor: z.string().trim().min(1).optional(),
})

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const getConversationQuerySchema = z.object({
  messageLimit: z.coerce.number().int().positive().max(100).optional(),
  before: z.string().trim().min(1).optional(),
})

export type ListInboxQuery = z.infer<typeof listInboxQuerySchema>
export type GetConversationQuery = z.infer<typeof getConversationQuerySchema>
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>
export type UploadOutboundMediaFields = z.infer<typeof uploadOutboundMediaFieldsSchema>
