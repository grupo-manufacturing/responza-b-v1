import { z } from 'zod'

import { AGENT_REPLY_MAX_LENGTH } from './agent.constants.js'

export const agentQueueJobDataSchema = z.object({
  organizationId: z.string().uuid(),
  conversationId: z.string().uuid(),
  inboundMessageId: z.string().uuid(),
})

export type AgentQueueJobData = z.infer<typeof agentQueueJobDataSchema>

export const agentReplyResponseSchema = z.union([
  z.object({
    shouldReply: z.literal(false),
  }),
  z.object({
    shouldReply: z.literal(true),
    reply: z.string().trim().min(1).max(AGENT_REPLY_MAX_LENGTH),
  }),
])

export type AgentReplyResponse = z.infer<typeof agentReplyResponseSchema>

export function normalizeAgentReplyResponse(raw: string): AgentReplyResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON response')
  }

  const result = agentReplyResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('Invalid agent reply shape')
  }

  return result.data
}

export type AgentJobSkipReason =
  | 'agent_disabled_globally'
  | 'agent_disabled_for_org'
  | 'onboarding_incomplete'
  | 'daily_limit_reached'
  | 'unsupported_message_type'
  | 'empty_message'
  | 'inbound_message_not_found'
  | 'superseded_by_newer_inbound'
  | 'human_replied'
  | 'ai_disabled'
  | 'not_answerable'
  | 'no_reply_generated'
  | 'already_replied'

export type AgentJobResult =
  | {
      action: 'skipped'
      reason: AgentJobSkipReason
    }
  | {
      action: 'replied'
      messageId: string
    }
