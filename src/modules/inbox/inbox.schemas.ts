import { z } from 'zod'

import { SUPPORTED_PLATFORMS } from '../integrations/integrations.constants.js'

const apiPlatformSchema = z.enum(SUPPORTED_PLATFORMS)

const contentSchema = z.string().trim().min(1).max(10000)

export const listInboxQuerySchema = z.object({
  platform: apiPlatformSchema.optional(),
})

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const sendMessageBodySchema = z.object({
  content: contentSchema,
})

export type ListInboxQuery = z.infer<typeof listInboxQuerySchema>
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>
