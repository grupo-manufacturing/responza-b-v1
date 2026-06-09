import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type {
  AiRestrictions,
  CommonConversationTypes,
  CustomerMessageLanguage,
  CustomerTone,
} from './business-details.constants.js'

export type BusinessProfileRecord = {
  id: string
  organization_id: string
  brand_and_products: string | null
  customer_tone: CustomerTone | null
  sample_customer_reply: string | null
  common_conversation_types: CommonConversationTypes | null
  customer_message_language: CustomerMessageLanguage | null
  signature_phrases: string | null
  ai_restrictions: AiRestrictions | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type BusinessProfileUpdatePatch = {
  brand_and_products?: string
  customer_tone?: CustomerTone
  sample_customer_reply?: string
  common_conversation_types?: CommonConversationTypes
  customer_message_language?: CustomerMessageLanguage
  signature_phrases?: string
  ai_restrictions?: AiRestrictions
}

const PROFILE_COLUMNS =
  'id, organization_id, brand_and_products, customer_tone, sample_customer_reply, common_conversation_types, customer_message_language, signature_phrases, ai_restrictions, completed_at, created_at, updated_at'

export async function findProfileByOrganizationId(
  organizationId: string,
): Promise<BusinessProfileRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_business_profiles')
    .select(PROFILE_COLUMNS)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load business details profile')
  }

  return data as BusinessProfileRecord | null
}

export async function completeProfile(
  organizationId: string,
  patch: BusinessProfileUpdatePatch,
): Promise<BusinessProfileRecord> {
  const client = getSupabaseAdminClient()
  const completedAt = new Date().toISOString()
  const { data, error } = await client
    .from('organization_business_profiles')
    .update({
      ...patch,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('organization_id', organizationId)
    .select(PROFILE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to complete business details')
  }

  return data as BusinessProfileRecord
}
