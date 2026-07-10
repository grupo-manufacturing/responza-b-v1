import { z } from 'zod'

import { completeChatJson } from '../ai/providers/openai.client.js'

const gateResponseSchema = z.object({
  action: z.enum(['skip', 'reply']),
  reason: z
    .enum(['greeting_only', 'needs_human', 'answerable', 'insufficient_context', 'other'])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
})

export type AgentGateResult = z.infer<typeof gateResponseSchema>

export async function runAgentGate(input: {
  inboundMessage: string
  recentTranscript: string
}): Promise<AgentGateResult> {
  const raw = await completeChatJson({
    system: [
      'You are a conservative gate for a business auto-reply agent.',
      'Return valid JSON only in this shape:',
      '{"action":"skip"|"reply","reason":"greeting_only"|"needs_human"|"answerable"|"insufficient_context"|"other","confidence":0.0}',
      'Default to action "skip".',
      'Only choose "reply" when the latest customer message is clearly answerable from business knowledge or simple greetings that need a short acknowledgement.',
      'Choose "skip" for complaints, refunds, legal issues, order-specific lookups without enough context, media-only references, or when a human should handle the thread.',
    ].join('\n'),
    user: [
      'Recent conversation:',
      input.recentTranscript || '(no prior messages)',
      '',
      'Latest inbound customer message:',
      input.inboundMessage,
      '',
      'Should the agent attempt a knowledge-backed reply?',
    ].join('\n'),
  })

  const parsed = gateResponseSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    return {
      action: 'skip',
      reason: 'other',
      confidence: 0,
    }
  }

  return parsed.data
}
