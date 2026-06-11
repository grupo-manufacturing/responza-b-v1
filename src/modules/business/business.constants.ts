export const CUSTOMER_TONE_VALUES = [
  'very_formal_sir_madam',
  'semi_formal_friendly',
  'casual_like_friend',
  'hinglish_local_feel',
  'fully_regional_language',
] as const

export const COMMON_CONVERSATION_TYPES_VALUES = [
  'order_status_tracking',
  'product_enquiries',
  'complaints_returns',
  'payment_issues',
  'all_of_the_above',
] as const

export const CUSTOMER_MESSAGE_LANGUAGE_VALUES = [
  'english',
  'hindi',
  'hinglish',
  'regional',
  'mix_of_everything',
] as const

export const AI_RESTRICTIONS_VALUES = [
  'never_mention_competitors',
  'never_offer_discounts_without_approval',
  'never_discuss_refunds_directly',
  'never_use_slang',
  'no_restrictions',
] as const

export type CustomerTone = (typeof CUSTOMER_TONE_VALUES)[number]
export type CommonConversationTypes = (typeof COMMON_CONVERSATION_TYPES_VALUES)[number]
export type CustomerMessageLanguage = (typeof CUSTOMER_MESSAGE_LANGUAGE_VALUES)[number]
export type AiRestrictions = (typeof AI_RESTRICTIONS_VALUES)[number]
