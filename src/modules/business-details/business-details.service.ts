import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { CompleteBusinessDetailsBody } from './business-details.schemas.js'
import * as businessDetailsRepository from './business-details.repository.js'
import type { BusinessProfileRecord } from './business-details.repository.js'

function toBusinessDetailsResponse(profile: BusinessProfileRecord) {
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
    throw new AppError(403, 'FORBIDDEN', 'Cannot access business details for another organization')
  }
}

function bodyToProfilePatch(input: CompleteBusinessDetailsBody): businessDetailsRepository.BusinessProfileUpdatePatch {
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

export async function getBusinessDetails(auth: AuthContext) {
  const profile = await businessDetailsRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business details profile not found')
  }

  assertOrganizationAccess(auth, profile.organization_id)
  return toBusinessDetailsResponse(profile)
}

export async function completeBusinessDetails(auth: AuthContext, input: CompleteBusinessDetailsBody) {
  const profile = await businessDetailsRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business details profile not found')
  }

  if (profile.completed_at !== null) {
    return toBusinessDetailsResponse(profile)
  }

  const completed = await businessDetailsRepository.completeProfile(
    auth.organizationId,
    bodyToProfilePatch(input),
  )
  return toBusinessDetailsResponse(completed)
}
