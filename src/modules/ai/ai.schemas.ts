import { z } from 'zod'

import {
  CONVERSATION_SUMMARY_MAX_LENGTH,
  CUSTOMER_HISTORY_MAX_LENGTH,
  SUGGESTED_ACTION_MAX_LENGTH,
  SUGGESTED_ACTIONS_COUNT,
  SUGGEST_REPLY_MAX_COUNT,
  SUGGEST_REPLY_MAX_LENGTH,
  SUGGEST_REPLY_MIN_COUNT,
  TRANSLATION_LANGUAGE_VALUES,
} from './ai.constants.js'

export const translationLanguageSchema = z.enum(TRANSLATION_LANGUAGE_VALUES)

export const rewriteBodySchema = z.object({
  draft: z.string().trim().min(1).max(2000),
})

export const translateBodySchema = z.object({
  messageId: z.string().uuid(),
})

export const suggestReplyBodySchema = z.object({
  conversationId: z.string().uuid(),
})

export const conversationAnalyticsBodySchema = z.object({
  conversationId: z.string().uuid(),
})

export const suggestReplyResponseSchema = z.object({
  suggestions: z
    .array(z.string().trim().min(1).max(SUGGEST_REPLY_MAX_LENGTH))
    .min(SUGGEST_REPLY_MIN_COUNT)
    .max(SUGGEST_REPLY_MAX_COUNT),
})

export const conversationAnalyticsResponseSchema = z.object({
  leadScore: z.number().int().min(0).max(100),
  suggestedActions: z
    .array(z.string().trim().min(1).max(SUGGESTED_ACTION_MAX_LENGTH))
    .length(SUGGESTED_ACTIONS_COUNT),
  customerHistory: z.string().trim().min(1).max(CUSTOMER_HISTORY_MAX_LENGTH),
  conversationSummary: z.string().trim().min(1).max(CONVERSATION_SUMMARY_MAX_LENGTH),
})

export type RewriteBody = z.infer<typeof rewriteBodySchema>
export type TranslateBody = z.infer<typeof translateBodySchema>
export type SuggestReplyBody = z.infer<typeof suggestReplyBodySchema>
export type ConversationAnalyticsBody = z.infer<typeof conversationAnalyticsBodySchema>

export function normalizeSuggestReplyResponse(raw: string): { suggestions: string[] } {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON response')
  }

  const result = suggestReplyResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('Invalid suggestions shape')
  }

  return result.data
}

export function normalizeConversationAnalyticsResponse(raw: string): {
  leadScore: number
  suggestedActions: string[]
  customerHistory: string
  conversationSummary: string
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON response')
  }

  const result = conversationAnalyticsResponseSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('Invalid conversation analytics shape')
  }

  return result.data
}
