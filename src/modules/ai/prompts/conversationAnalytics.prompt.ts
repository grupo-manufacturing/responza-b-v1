import type { BusinessProfileRecord } from '../../business/business.repository.js'
import type { CommonConversationTypes } from '../../business/business.constants.js'
import { ANALYTICS_RECENT_MESSAGE_COUNT } from '../ai.constants.js'

const CONVERSATION_GUIDANCE: Record<CommonConversationTypes, string> = {
  order_status_tracking: 'Customers often ask about order status and delivery.',
  product_enquiries: 'Customers often ask about products, pricing, and availability.',
  complaints_returns: 'Customers may raise complaints or return requests.',
  payment_issues: 'Customers may ask about payment, invoices, or UPI issues.',
  all_of_the_above: 'Handle mixed enquiries: orders, products, complaints, and payments.',
}

function optionalLine(label: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null
  }

  return `${label}: ${value.trim()}`
}

export function buildConversationAnalyticsSystemPrompt(profile: BusinessProfileRecord | null): string {
  const lines = [
    'You analyze business inbox conversations on WhatsApp or Instagram for a sales/support agent.',
    'Return valid JSON only in this exact shape:',
    '{"leadScore":0,"suggestedActions":["...","...","..."],"customerHistory":"...","conversationSummary":"..."}',
    '',
    'Field rules:',
    '- leadScore: integer from 0 to 100 estimating how likely this contact is to become a paying customer. Base this on buying intent, engagement, urgency, specificity of requests, objections, and follow-through. 0 = no intent, 100 = ready to purchase.',
    `- suggestedActions: exactly 3 distinct, concrete next steps for the agent, ordered by priority. Each must be specific to this thread — no generic advice like "be polite".`,
    '- customerHistory: a concise narrative of the full conversation transcript — who the customer is (if inferable), what they have asked about over time, commitments made, tone, and recurring themes. Use the entire transcript provided, not only recent messages.',
    `- conversationSummary: summarize only the latest activity — focus on the most recent ~${ANALYTICS_RECENT_MESSAGE_COUNT} messages or since the last major topic shift. Cover what happened lately, the current state, and what is unresolved right now.`,
    '',
    'Guardrails:',
    '- Do not invent prices, order IDs, dates, discounts, or promises not supported by the transcript.',
    '- For media placeholders like [image], note that media was shared without guessing its content.',
    '- Do not draft reply messages — only analyze and recommend actions.',
    '- Write customerHistory and conversationSummary in clear English unless the thread is predominantly in another language.',
  ]

  if (profile === null) {
    return lines.join('\n')
  }

  const brandLine = optionalLine('Business context', profile.brand_and_products)
  if (brandLine !== null) {
    lines.push(brandLine)
  }

  if (profile.common_conversation_types !== null) {
    lines.push(`Typical enquiries: ${CONVERSATION_GUIDANCE[profile.common_conversation_types]}`)
  }

  return lines.join('\n')
}

export function buildConversationAnalyticsUserPrompt(input: {
  transcript: string
  omittedOlderMessageCount: number
}): string {
  const lines: string[] = []

  if (input.omittedOlderMessageCount > 0) {
    lines.push(
      `[Note: ${input.omittedOlderMessageCount} older messages were omitted from this transcript. Do not invent events from omitted messages.]`,
      '',
    )
  }

  lines.push(
    'Full conversation transcript (oldest to newest):',
    input.transcript,
    '',
    'Return conversation analytics as JSON with leadScore, suggestedActions, customerHistory, and conversationSummary.',
  )

  return lines.join('\n')
}
