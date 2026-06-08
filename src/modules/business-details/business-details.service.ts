import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import type {
  CompleteBusinessDetailsBody,
  UpdateBusinessDetailsBody,
} from './business-details.schemas.js'
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

function isProfileCompleteForSubmission(profile: BusinessProfileRecord): boolean {
  return (
    (profile.brand_and_products?.trim().length ?? 0) > 0 &&
    profile.customer_tone !== null &&
    (profile.sample_customer_reply?.trim().length ?? 0) >= 20 &&
    profile.common_conversation_types !== null &&
    profile.customer_message_language !== null &&
    (profile.signature_phrases?.trim().length ?? 0) > 0 &&
    profile.ai_restrictions !== null
  )
}

export async function getBusinessDetails(auth: AuthContext) {
  const profile = await businessDetailsRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business details profile not found')
  }

  assertOrganizationAccess(auth, profile.organization_id)
  return toBusinessDetailsResponse(profile)
}

export async function updateBusinessDetails(auth: AuthContext, input: UpdateBusinessDetailsBody) {
  const profile = await businessDetailsRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business details profile not found')
  }

  const patch: businessDetailsRepository.BusinessProfileUpdatePatch = {}

  if (input.brandAndProducts !== undefined) {
    patch.brand_and_products = input.brandAndProducts
  }
  if (input.customerTone !== undefined) {
    patch.customer_tone = input.customerTone
  }
  if (input.sampleCustomerReply !== undefined) {
    patch.sample_customer_reply = input.sampleCustomerReply
  }
  if (input.commonConversationTypes !== undefined) {
    patch.common_conversation_types = input.commonConversationTypes
  }
  if (input.customerMessageLanguage !== undefined) {
    patch.customer_message_language = input.customerMessageLanguage
  }
  if (input.signaturePhrases !== undefined) {
    patch.signature_phrases = input.signaturePhrases
  }
  if (input.aiRestrictions !== undefined) {
    patch.ai_restrictions = input.aiRestrictions
  }

  const updated = await businessDetailsRepository.updateProfile(auth.organizationId, patch)
  return toBusinessDetailsResponse(updated)
}

export async function completeBusinessDetails(auth: AuthContext, input: CompleteBusinessDetailsBody) {
  const profile = await businessDetailsRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business details profile not found')
  }

  if (profile.completed_at !== null) {
    return toBusinessDetailsResponse(profile)
  }

  if (input.skip !== true && !isProfileCompleteForSubmission(profile)) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Answer all business details questions before completing, or pass skip=true',
    )
  }

  const completed = await businessDetailsRepository.markProfileCompleted(auth.organizationId)
  return toBusinessDetailsResponse(completed)
}
