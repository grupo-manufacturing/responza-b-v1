import { z } from 'zod'

import { INBOX_PLATFORMS } from './inbox.constants.js'

const messageContentTypeSchema = z.enum(['text', 'image', 'video', 'audio', 'document'])
const messageDirectionSchema = z.enum(['inbound', 'outbound'])
const inboxPlatformSchema = z.enum(INBOX_PLATFORMS)

export const listInboxQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).optional(),
  platform: inboxPlatformSchema.optional(),
})

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).optional(),
  direction: messageDirectionSchema.optional(),
})

export const createMessageBodySchema = z
  .object({
    body: z.string().trim().min(1).max(10_000).optional(),
    contentType: messageContentTypeSchema.default('text'),
    fileUrl: z.string().url().max(2048).optional(),
  })
  .refine(
    (value) =>
      value.contentType === 'text'
        ? value.body !== undefined && value.body.length > 0
        : value.fileUrl !== undefined,
    { message: 'Text messages require body; media messages require fileUrl' },
  )

export type ListInboxQuery = z.infer<typeof listInboxQuerySchema>
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>
export type CreateMessageBody = z.infer<typeof createMessageBodySchema>
