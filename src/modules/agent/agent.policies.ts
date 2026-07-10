import { z } from 'zod'

const replyResponseSchema = z.object({
  reply: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sources_used: z.array(z.string()).default([]),
  should_send: z.boolean().default(false),
})

export type AgentReplyResult = z.infer<typeof replyResponseSchema>

export function passesAgentPolicies(input: {
  inboundMessage: string
  reply: string
}): { allowed: boolean; reason?: string } {
  const combined = `${input.inboundMessage}\n${input.reply}`.toLowerCase()

  const blockedPatterns = [
    /\brefund\b/,
    /\blegal\b/,
    /\blawyer\b/,
    /\bpolice\b/,
    /\bcomplaint\b/,
    /\bchargeback\b/,
    /\btalk to (a )?human\b/,
    /\bhuman agent\b/,
  ]

  for (const pattern of blockedPatterns) {
    if (pattern.test(combined)) {
      return { allowed: false, reason: 'policy_blocked' }
    }
  }

  const inventedPricePattern = /(?:₹|rs\.?|inr)\s?\d+/i
  if (inventedPricePattern.test(input.reply) && !inventedPricePattern.test(input.inboundMessage)) {
    return { allowed: false, reason: 'invented_price' }
  }

  return { allowed: true }
}

export function normalizeAgentReplyResult(raw: string): AgentReplyResult | null {
  try {
    const parsed = replyResponseSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
