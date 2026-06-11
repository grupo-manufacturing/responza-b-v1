import { z } from 'zod'

import { SUPPORTED_PLATFORMS } from '../integrations/integrations.constants.js'

export const MESSAGE_DIRECTION_VALUES = ['inbound', 'outbound'] as const
export const MESSAGE_STATUS_VALUES = ['pending', 'sent', 'failed'] as const

export type MessageDirection = (typeof MESSAGE_DIRECTION_VALUES)[number]
export type MessageStatus = (typeof MESSAGE_STATUS_VALUES)[number]

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

export const sendMessageBodySchema = z.object({
  content: contentSchema,
})

export type ListInboxQuery = z.infer<typeof listInboxQuerySchema>
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>
