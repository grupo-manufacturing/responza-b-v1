import { z } from 'zod'

import { translationLanguageSchema } from './translation.constants.js'

export const rewriteBodySchema = z.object({
  draft: z.string().trim().min(1).max(2000),
})

export const translateBodySchema = z.object({
  messageId: z.string().uuid(),
})

export type RewriteBody = z.infer<typeof rewriteBodySchema>
export type TranslateBody = z.infer<typeof translateBodySchema>

export { translationLanguageSchema }
