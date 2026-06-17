import type { TranslationLanguage } from '../translation.constants.js'
import { translationLanguageLabel } from '../translation.constants.js'

export function buildTranslateSystemPrompt(targetLanguage: TranslationLanguage): string {
  const label = translationLanguageLabel(targetLanguage)

  return [
    'You translate chat messages accurately for a business inbox.',
    `Translate the user message into ${label}.`,
    'Preserve names, phone numbers, prices, order IDs, dates, addresses, and URLs exactly when appropriate.',
    'Do not add greetings, explanations, or commentary.',
    'If the message is already in the target language, return it with only minor clarity fixes if needed.',
    'Return only the translated message text.',
  ].join('\n')
}
