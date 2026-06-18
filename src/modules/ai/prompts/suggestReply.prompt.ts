import type { BusinessProfileRecord } from '../../business/business.repository.js'
import type {
  AiRestrictions,
  CommonConversationTypes,
  CustomerMessageLanguage,
  CustomerTone,
} from '../../business/business.constants.js'

const TONE_GUIDANCE: Record<CustomerTone, string> = {
  very_formal_sir_madam: 'Use very formal language with respectful sir/madam style.',
  semi_formal_friendly: 'Use semi-formal, warm, and approachable language.',
  casual_like_friend: 'Use casual, friendly language suitable for chat.',
  hinglish_local_feel: 'Use natural Hinglish where appropriate — mix Hindi and English like local business chat.',
  fully_regional_language: 'Prefer regional Indian language tone while keeping messages clear.',
}

const LANGUAGE_GUIDANCE: Record<CustomerMessageLanguage, string> = {
  english: 'Write primarily in English.',
  hindi: 'Write primarily in Hindi (Devanagari script).',
  hinglish: 'Write in Hinglish — natural mix of Hindi and English.',
  regional: 'Use regional language tone where appropriate.',
  mix_of_everything: 'Match the language style used in the recent conversation.',
}

const CONVERSATION_GUIDANCE: Record<CommonConversationTypes, string> = {
  order_status_tracking: 'Customers often ask about order status and delivery.',
  product_enquiries: 'Customers often ask about products, pricing, and availability.',
  complaints_returns: 'Customers may raise complaints or return requests — stay calm and helpful.',
  payment_issues: 'Customers may ask about payment, invoices, or UPI issues.',
  all_of_the_above: 'Handle mixed enquiries: orders, products, complaints, and payments.',
}

const RESTRICTION_GUIDANCE: Record<AiRestrictions, string> = {
  never_mention_competitors: 'Never mention competitors or compare with other brands.',
  never_offer_discounts_without_approval: 'Never offer discounts, deals, or price reductions unless already stated in the thread.',
  never_discuss_refunds_directly: 'Do not discuss refunds or returns directly; stay helpful without committing to refund policy.',
  never_use_slang: 'Avoid slang and overly casual abbreviations.',
  no_restrictions: 'No extra content restrictions beyond accuracy and professionalism.',
}

function optionalLine(label: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value.trim().length === 0) {
    return null
  }

  return `${label}: ${value.trim()}`
}

export function buildSuggestReplySystemPrompt(
  profile: BusinessProfileRecord | null,
  latestMessageIsOutbound: boolean,
): string {
  const lines = [
    'You generate reply suggestions for a business inbox on WhatsApp or Instagram.',
    'Return valid JSON only in this exact shape: {"suggestions":["...","..."]}.',
    'Provide exactly 2 or 3 distinct reply options.',
    'Each suggestion must be ready to send — no labels, numbering, or quotes inside the strings.',
    'Keep replies concise and suitable for mobile chat.',
    'Do not invent prices, discounts, dates, order IDs, or promises that are not supported by the thread or business context.',
    latestMessageIsOutbound
      ? 'The latest message in the thread was sent by the business. Suggest polite follow-up messages that move the conversation forward without being pushy.'
      : 'The latest message in the thread is from the customer. Suggest replies that directly address their most recent message.',
    'Use earlier messages only as supporting context.',
  ]

  if (profile === null) {
    lines.push('Tone: clear, polite, and professional for Indian SMB customers.')
    return lines.join('\n')
  }

  if (profile.customer_tone !== null) {
    lines.push(`Tone: ${TONE_GUIDANCE[profile.customer_tone]}`)
  }

  if (profile.customer_message_language !== null) {
    lines.push(`Language: ${LANGUAGE_GUIDANCE[profile.customer_message_language]}`)
  }

  if (profile.common_conversation_types !== null) {
    lines.push(`Context: ${CONVERSATION_GUIDANCE[profile.common_conversation_types]}`)
  }

  const brandLine = optionalLine('Business', profile.brand_and_products)
  if (brandLine !== null) {
    lines.push(brandLine)
  }

  const sampleLine = optionalLine('Style reference (do not copy verbatim)', profile.sample_customer_reply)
  if (sampleLine !== null) {
    lines.push(sampleLine)
  }

  const signatureLine = optionalLine('Preferred sign-off phrases when appropriate', profile.signature_phrases)
  if (signatureLine !== null) {
    lines.push(signatureLine)
  }

  if (profile.ai_restrictions !== null) {
    lines.push(`Restrictions: ${RESTRICTION_GUIDANCE[profile.ai_restrictions]}`)
  }

  return lines.join('\n')
}

export function buildSuggestReplyUserPrompt(transcript: string): string {
  return [
    'Recent conversation (oldest to newest):',
    transcript,
    '',
    'Generate 2-3 reply suggestions for the business to send next.',
  ].join('\n')
}
