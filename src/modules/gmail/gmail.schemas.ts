import { z } from 'zod'

export const GMAIL_MESSAGES_DEFAULT_PAGE_SIZE = 20
export const GMAIL_MESSAGES_MAX_PAGE_SIZE = 50

export const listGmailMessagesQuerySchema = z.object({
  pageToken: z.string().trim().min(1).optional(),
  maxResults: z.coerce
    .number()
    .int()
    .positive()
    .max(GMAIL_MESSAGES_MAX_PAGE_SIZE)
    .default(GMAIL_MESSAGES_DEFAULT_PAGE_SIZE),
})

export const gmailMessageParamsSchema = z.object({
  id: z.string().trim().min(1),
})

export const sendGmailMessageBodySchema = z.object({
  to: z.string().trim().min(1).email(),
  subject: z.string().trim().min(1).max(998),
  body: z.string().trim().min(1).max(100_000),
})

export const replyGmailMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(100_000),
})

export type ListGmailMessagesQuery = z.infer<typeof listGmailMessagesQuerySchema>
export type SendGmailMessageBody = z.infer<typeof sendGmailMessageBodySchema>
export type ReplyGmailMessageBody = z.infer<typeof replyGmailMessageBodySchema>
