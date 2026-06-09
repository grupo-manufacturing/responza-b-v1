import { z } from 'zod'

import {
  AI_RESTRICTIONS_VALUES,
  COMMON_CONVERSATION_TYPES_VALUES,
  CUSTOMER_MESSAGE_LANGUAGE_VALUES,
  CUSTOMER_TONE_VALUES,
} from './business-details.constants.js'

const trimmedText = (max: number) => z.string().trim().min(1).max(max)

export const customerToneSchema = z.enum(CUSTOMER_TONE_VALUES)
export const commonConversationTypesSchema = z.enum(COMMON_CONVERSATION_TYPES_VALUES)
export const customerMessageLanguageSchema = z.enum(CUSTOMER_MESSAGE_LANGUAGE_VALUES)
export const aiRestrictionsSchema = z.enum(AI_RESTRICTIONS_VALUES)

export const completeBusinessDetailsBodySchema = z.object({
  brandAndProducts: trimmedText(2000),
  customerTone: customerToneSchema,
  sampleCustomerReply: trimmedText(2000).min(20),
  commonConversationTypes: commonConversationTypesSchema,
  customerMessageLanguage: customerMessageLanguageSchema,
  signaturePhrases: trimmedText(500),
  aiRestrictions: aiRestrictionsSchema,
})

export type CompleteBusinessDetailsBody = z.infer<typeof completeBusinessDetailsBodySchema>
