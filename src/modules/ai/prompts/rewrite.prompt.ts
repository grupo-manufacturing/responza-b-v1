import type { BusinessProfileRecord } from '../../business/business.repository.js'
import type {
  AiRestrictions,
  CustomerMessageLanguage,
  CustomerTone,
} from '../../business/business.constants.js'

const TONE_GUIDANCE: Record<CustomerTone, string> = {
  very_formal_sir_madam: 'Use very formal language with respectful sir/madam style.',
  semi_formal_friendly: 'Use semi-formal, warm, and approachable language.',
  casual_like_friend: 'Use casual, friendly language suitable for chat.',
  hinglish_local_feel: 'Use natural Hinglish where appropriate — mix Hindi and English like local business chat.',
  fully_regional_language: 'Prefer regional Indian language tone while keeping the message clear.',
}

const LANGUAGE_GUIDANCE: Record<CustomerMessageLanguage, string> = {
  english: 'Write primarily in English.',
  hindi: 'Write primarily in Hindi (Devanagari script).',
  hinglish: 'Write in Hinglish — natural mix of Hindi and English.',
  regional: 'Use regional language tone where appropriate.',
  mix_of_everything: 'Match the language style of the draft; keep it natural for Indian customers.',
}

const RESTRICTION_GUIDANCE: Record<AiRestrictions, string> = {
  never_mention_competitors: 'Never mention competitors or compare with other brands.',
  never_offer_discounts_without_approval: 'Never offer discounts, deals, or price reductions unless already stated in the draft.',
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

export function buildRewriteSystemPrompt(profile: BusinessProfileRecord | null): string {
  const lines = [
    'You rewrite outbound customer messages for a small business using WhatsApp or Instagram.',
    'Preserve the original meaning, facts, numbers, prices, dates, names, and promises.',
    'Do not invent information that is not in the draft.',
    'Keep the message concise and suitable for mobile chat.',
    'Return only the rewritten message text — no quotes, labels, or explanation.',
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

  const brandLine = optionalLine('Business context', profile.brand_and_products)
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
