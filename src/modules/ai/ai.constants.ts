export const SUGGEST_REPLY_MESSAGE_LIMIT = 10
export const SUGGEST_REPLY_MIN_COUNT = 2
export const SUGGEST_REPLY_MAX_COUNT = 3
export const SUGGEST_REPLY_MAX_LENGTH = 1000

export const ANALYTICS_MIN_MESSAGES = 1
export const ANALYTICS_MAX_MESSAGES = 150
export const ANALYTICS_RECENT_MESSAGE_COUNT = 10
export const SUGGESTED_ACTIONS_COUNT = 3
export const SUGGESTED_ACTION_MAX_LENGTH = 200
export const CUSTOMER_HISTORY_MAX_LENGTH = 2000
export const CONVERSATION_SUMMARY_MAX_LENGTH = 800

export const TRANSLATION_LANGUAGE_VALUES = [
  'arabic',
  'spanish',
  'hindi',
  'bengali',
  'telugu',
  'marathi',
  'tamil',
  'gujarati',
  'kannada',
  'malayalam',
  'punjabi',
  'odia',
] as const

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGE_VALUES)[number]

export const TRANSLATION_LANGUAGES: ReadonlyArray<{
  code: TranslationLanguage
  label: string
}> = [
  { code: 'arabic', label: 'Arabic' },
  { code: 'spanish', label: 'Spanish' },
  { code: 'hindi', label: 'Hindi' },
  { code: 'bengali', label: 'Bengali' },
  { code: 'telugu', label: 'Telugu' },
  { code: 'marathi', label: 'Marathi' },
  { code: 'tamil', label: 'Tamil' },
  { code: 'gujarati', label: 'Gujarati' },
  { code: 'kannada', label: 'Kannada' },
  { code: 'malayalam', label: 'Malayalam' },
  { code: 'punjabi', label: 'Punjabi' },
  { code: 'odia', label: 'Odia' },
]

const TRANSLATION_LANGUAGE_LABELS: Record<TranslationLanguage, string> = {
  arabic: 'Arabic',
  spanish: 'Spanish',
  hindi: 'Hindi',
  bengali: 'Bengali',
  telugu: 'Telugu',
  marathi: 'Marathi',
  tamil: 'Tamil',
  gujarati: 'Gujarati',
  kannada: 'Kannada',
  malayalam: 'Malayalam',
  punjabi: 'Punjabi',
  odia: 'Odia',
}

export function translationLanguageLabel(language: TranslationLanguage): string {
  return TRANSLATION_LANGUAGE_LABELS[language]
}
