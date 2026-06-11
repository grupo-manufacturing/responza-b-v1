import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { CompleteBusinessBody } from './business.schemas.js'
import * as businessRepository from './business.repository.js'
import type { BusinessProfileRecord } from './business.repository.js'

function toBusinessResponse(profile: BusinessProfileRecord) {
  return {
    organizationId: profile.organization_id,
    brandAndProducts: profile.brand_and_products,
    customerTone: profile.customer_tone,
    sampleCustomerReply: profile.sample_customer_reply,
    commonConversationTypes: profile.common_conversation_types,
    customerMessageLanguage: profile.customer_message_language,
    signaturePhrases: profile.signature_phrases,
    aiRestrictions: profile.ai_restrictions,
    completed: profile.completed_at !== null,
    completedAt: profile.completed_at,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

function assertOrganizationAccess(auth: AuthContext, organizationId: string): void {
  if (auth.organizationId !== organizationId) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot access business profile for another organization')
  }
}

function bodyToProfilePatch(input: CompleteBusinessBody): businessRepository.BusinessProfileUpdatePatch {
  return {
    brand_and_products: input.brandAndProducts,
    customer_tone: input.customerTone,
    sample_customer_reply: input.sampleCustomerReply,
    common_conversation_types: input.commonConversationTypes,
    customer_message_language: input.customerMessageLanguage,
    signature_phrases: input.signaturePhrases,
    ai_restrictions: input.aiRestrictions,
  }
}

export async function getBusiness(auth: AuthContext) {
  const profile = await businessRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  assertOrganizationAccess(auth, profile.organization_id)
  return toBusinessResponse(profile)
}

export async function completeBusiness(auth: AuthContext, input: CompleteBusinessBody) {
  const profile = await businessRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  if (profile.completed_at !== null) {
    return toBusinessResponse(profile)
  }

  const completed = await businessRepository.completeProfile(
    auth.organizationId,
    bodyToProfilePatch(input),
  )
  return toBusinessResponse(completed)
}
