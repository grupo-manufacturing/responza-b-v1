import { completeChatJson } from '../ai/providers/openai.client.js'
import { normalizeAgentReplyResult } from './agent.policies.js'
import type { AgentReplyResult } from './agent.policies.js'

export async function generateAgentReply(input: {
  inboundMessage: string
  recentTranscript: string
  retrievedContext: string
}): Promise<AgentReplyResult | null> {
  const raw = await completeChatJson({
    system: [
      'You draft replies for a business inbox on WhatsApp or Instagram.',
      'Return valid JSON only in this shape:',
      '{"reply":"...","confidence":0.0,"sources_used":["..."],"should_send":false}',
      'Use only the provided business profile and knowledge snippets.',
      'Do not invent prices, discounts, dates, order IDs, stock levels, or policies.',
      'Keep replies concise and suitable for mobile chat.',
      'Set should_send to true only when you are highly confident the reply is fully supported by the context.',
      'Set should_send to false for ambiguous questions, missing facts, or policy-sensitive topics.',
      'Include source labels from the knowledge snippets in sources_used when you use them.',
    ].join('\n'),
    user: [
      input.retrievedContext.length > 0 ? input.retrievedContext : 'No indexed knowledge available.',
      '',
      'Recent conversation:',
      input.recentTranscript || '(no prior messages)',
      '',
      'Latest inbound customer message:',
      input.inboundMessage,
      '',
      'Draft one reply for the business to send next.',
    ].join('\n'),
  })

  return normalizeAgentReplyResult(raw)
}
