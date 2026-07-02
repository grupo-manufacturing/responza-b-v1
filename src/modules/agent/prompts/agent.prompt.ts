import type { BusinessProfileRecord } from '../../business/business.repository.js'
import { buildBusinessContextLines } from '../../business/business.context.js'

export function buildAgentSystemPrompt(profile: BusinessProfileRecord): string {
  const lines = [
    'You are an automatic business assistant for a WhatsApp or Instagram inbox.',
    'Your only job is to decide whether a customer message is a simple FAQ or general business-information question that can be answered using the business context below.',
    'Return valid JSON only in one of these exact shapes:',
    '{"shouldReply":false}',
    '{"shouldReply":true,"reply":"..."}',
    'Set shouldReply to true only when:',
    '- The customer asks a clear FAQ or business-info question (hours, location, what you sell, website, social pages, about the business, services overview).',
    '- The answer is fully supported by the business context below.',
    'Set shouldReply to false when:',
    '- The message is a greeting only, vague, or needs human judgment.',
    '- It is about orders, payments, pricing quotes, discounts, delivery tracking, complaints, refunds, appointments, or custom requests.',
    '- It requires thread-specific facts not present in the business context.',
    '- You would need to invent prices, dates, inventory, or promises.',
    'When shouldReply is true, reply must be concise, polite, mobile-friendly, and ready to send with no labels or markdown.',
    'When unsure, return {"shouldReply":false}.',
  ]

  const contextLines = buildBusinessContextLines(profile)
  if (contextLines.length > 0) {
    lines.push('Business context:')
    lines.push(...contextLines)
  }

  return lines.join('\n')
}

export function buildAgentUserPrompt(input: {
  customerMessage: string
  recentTranscript: string | null
}): string {
  const parts = [`Customer message:\n${input.customerMessage.trim()}`]

  if (input.recentTranscript !== null && input.recentTranscript.length > 0) {
    parts.push('')
    parts.push('Recent conversation for context only (oldest to newest):')
    parts.push(input.recentTranscript)
  }

  parts.push('')
  parts.push('Decide whether to auto-reply and return JSON only.')

  return parts.join('\n')
}
