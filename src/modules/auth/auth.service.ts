import { z } from 'zod'

import {
  type AuthContext,
  type AuthSessionPayload,
} from '../../shared/auth/index.js'
import { getSupabaseAdminClient, getSupabaseAuthClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import { getSubscriptionForOrganization } from '../subscription/subscription.service.js'
import { TRANSLATION_LANGUAGES } from '../ai/ai.constants.js'
import * as authCache from './auth.cache.js'
import * as authRepository from './auth.repository.js'
import { translationLanguageSchema } from '../ai/ai.schemas.js'
import { assertCanEnableBusinessAgent } from '../agent/agent.settings.service.js'
import {
  agentDailyReplyLimit,
  getAgentRepliesUsedToday,
} from '../agent/agent.limits.js'
import type { OrganizationRecord } from '../subscription/subscription.repository.js'

const emailFieldSchema = z.string().trim().email().transform((value) => value.toLowerCase())

export const registerBodySchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(160),
})

export const loginBodySchema = z.object({
  email: emailFieldSchema,
  password: z.string().min(1).max(128),
})

export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    preferredTranslationLanguage: translationLanguageSchema.nullable().optional(),
    agentEnabled: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.name !== undefined ||
      body.preferredTranslationLanguage !== undefined ||
      body.agentEnabled !== undefined,
    { message: 'At least one field is required' },
  )

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})

const OTP_MIN_LENGTH = 6
const OTP_MAX_LENGTH = 10

export const verifyOtpBodySchema = z.object({
  email: emailFieldSchema,
  token: z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{${OTP_MIN_LENGTH},${OTP_MAX_LENGTH}}$`),
      `Verification code must be ${OTP_MIN_LENGTH}–${OTP_MAX_LENGTH} digits`,
    ),
})

export const resendOtpBodySchema = z.object({
  email: emailFieldSchema,
})

export const oauthCompleteBodySchema = z.object({
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive().optional(),
})

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>
export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>
export type ResendOtpBody = z.infer<typeof resendOtpBodySchema>
export type OAuthCompleteBody = z.infer<typeof oauthCompleteBodySchema>
export type RefreshBody = z.infer<typeof refreshBodySchema>

export type AuthTokenRefreshPayload = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type RegisterPendingPayload = {
  requiresVerification: true
  email: string
}

function toAuthContext(organization: Pick<OrganizationRecord, 'id' | 'email' | 'name'>): AuthContext {
  return {
    organizationId: organization.id,
    email: organization.email,
    name: organization.name,
  }
}

function toOrganizationSummaryBase(organization: OrganizationRecord) {
  return {
    id: organization.id,
    email: organization.email,
    name: organization.name,
    plan: organization.plan,
    preferredTranslationLanguage: organization.preferred_translation_language ?? null,
    emailVerified: organization.email_verified,
    agentEnabled: organization.agent_enabled,
  }
}

async function buildOrganizationSummary(organization: OrganizationRecord) {
  const agentRepliesUsedToday = await getAgentRepliesUsedToday(organization.id)

  return {
    ...toOrganizationSummaryBase(organization),
    agentDailyLimit: agentDailyReplyLimit(),
    agentRepliesUsedToday,
  }
}

function isSupabaseEmailNotConfirmedError(message: string): boolean {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('confirm') ||
    normalized.includes('verified') ||
    normalized.includes('not confirmed')
  )
}

async function resendSignupOtp(email: string): Promise<void> {
  const authClient = getSupabaseAuthClient()
  const { error } = await authClient.auth.resend({
    type: 'signup',
    email,
  })

  if (error !== null) {
    throw new AppError(400, 'BAD_REQUEST', error.message)
  }
}

function resolveOrganizationNameFromUserMetadata(
  metadata: Record<string, unknown> | undefined,
  email: string,
): string {
  const candidates = [metadata?.organization_name, metadata?.full_name, metadata?.name]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim().slice(0, 160)
    }
  }

  const localPart = email.split('@')[0]?.trim()
  if (localPart !== undefined && localPart.length > 0) {
    return localPart.slice(0, 160)
  }

  return 'My Organization'
}

async function buildSessionPayload(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  organization: OrganizationRecord,
): Promise<AuthSessionPayload> {
  const [businessDetails, subscription] = await Promise.all([
    authRepository.findBusinessDetailsStatus(organization.id),
    getSubscriptionForOrganization(organization.id),
  ])

  return {
    accessToken,
    refreshToken,
    expiresIn,
    organization: await buildOrganizationSummary(organization),
    subscription,
    businessDetails: {
      completed:
        businessDetails?.completed_at !== null && businessDetails?.completed_at !== undefined,
      completedAt: businessDetails?.completed_at ?? null,
    },
  }
}

async function loadAuthContext(organizationId: string): Promise<AuthContext> {
  const organization = await authRepository.findOrganizationById(organizationId)
  if (organization === null) {
    throw new AppError(403, 'FORBIDDEN', 'No account found. Please register first.')
  }

  return toAuthContext(organization)
}

export async function resolveAuthContextFromAccessToken(accessToken: string): Promise<AuthContext> {
  const cached = await authCache.getCachedAuthContext(accessToken)
  if (cached !== null) {
    return cached
  }

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.getUser(accessToken)

  if (error !== null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token')
  }

  const auth = await loadAuthContext(data.user.id)
  await authCache.setCachedAuthContext(accessToken, auth)
  return auth
}

export async function registerOrganization(
  input: RegisterBody,
): Promise<AuthSessionPayload | RegisterPendingPayload> {
  const normalizedEmail = input.email
  const existing = await authRepository.findOrganizationByEmail(normalizedEmail)
  if (existing !== null) {
    if (existing.email_verified) {
      throw new AppError(409, 'CONFLICT', 'An account with this email already exists')
    }

    await resendSignupOtp(normalizedEmail)
    return { requiresVerification: true, email: normalizedEmail }
  }

  const authClient = getSupabaseAuthClient()
  const { data, error } = await authClient.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        organization_name: input.name,
      },
    },
  })

  if (error !== null) {
    if (error.message.toLowerCase().includes('already')) {
      const pendingOrg = await authRepository.findOrganizationByEmail(normalizedEmail)
      if (pendingOrg !== null && !pendingOrg.email_verified) {
        await resendSignupOtp(normalizedEmail)
        return { requiresVerification: true, email: normalizedEmail }
      }

      throw new AppError(409, 'CONFLICT', 'An account with this email already exists')
    }

    throw new AppError(400, 'BAD_REQUEST', error.message)
  }

  if (data.user === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create auth user')
  }

  const organization = await authRepository.createOrganization({
    id: data.user.id,
    email: normalizedEmail,
    name: input.name,
    emailVerified: false,
  })
  await authRepository.createBusinessProfile(organization.id)

  if (data.session !== null) {
    const verifiedOrganization = await authRepository.markOrganizationEmailVerified(organization.id)
    return buildSessionPayload(
      data.session.access_token,
      data.session.refresh_token,
      data.session.expires_in ?? 3600,
      verifiedOrganization,
    )
  }

  return { requiresVerification: true, email: normalizedEmail }
}

export async function verifyEmailOtp(input: VerifyOtpBody): Promise<AuthSessionPayload> {
  const normalizedEmail = input.email
  const authClient = getSupabaseAuthClient()
  const { data, error } = await authClient.auth.verifyOtp({
    email: normalizedEmail,
    token: input.token,
    type: 'email',
  })

  if (error !== null || data.session === null || data.user === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Invalid or expired verification code')
  }

  const organization = await authRepository.findOrganizationById(data.user.id)
  if (organization === null) {
    throw new AppError(403, 'FORBIDDEN', 'No account profile found. Please register first.')
  }

  const verifiedOrganization = organization.email_verified
    ? organization
    : await authRepository.markOrganizationEmailVerified(organization.id)

  return buildSessionPayload(
    data.session.access_token,
    data.session.refresh_token,
    data.session.expires_in ?? 3600,
    verifiedOrganization,
  )
}

export async function resendEmailOtp(input: ResendOtpBody): Promise<void> {
  const normalizedEmail = input.email
  const organization = await authRepository.findOrganizationByEmail(normalizedEmail)
  if (organization === null) {
    throw new AppError(404, 'NOT_FOUND', 'No account found for this email')
  }

  if (organization.email_verified) {
    throw new AppError(400, 'BAD_REQUEST', 'This email is already verified. Please sign in.')
  }

  await resendSignupOtp(normalizedEmail)
}

export async function completeOAuthSession(
  accessToken: string,
  input: OAuthCompleteBody,
): Promise<AuthSessionPayload> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.getUser(accessToken)

  if (error !== null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token')
  }

  const user = data.user
  const email = user.email?.trim().toLowerCase()
  if (email === undefined || email.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Google account did not provide an email address')
  }

  let organization = await authRepository.findOrganizationById(user.id)

  if (organization === null) {
    const existingByEmail = await authRepository.findOrganizationByEmail(email)
    if (existingByEmail !== null && existingByEmail.id !== user.id) {
      throw new AppError(
        409,
        'CONFLICT',
        'An account with this email already exists. Sign in with email and password instead.',
      )
    }

    const organizationName = resolveOrganizationNameFromUserMetadata(
      user.user_metadata as Record<string, unknown> | undefined,
      email,
    )

    organization = await authRepository.createOrganization({
      id: user.id,
      email,
      name: organizationName,
      emailVerified: true,
    })
    await authRepository.createBusinessProfile(organization.id)
  } else if (!organization.email_verified) {
    organization = await authRepository.markOrganizationEmailVerified(organization.id)
  }

  return buildSessionPayload(
    accessToken,
    input.refreshToken,
    input.expiresIn ?? 3600,
    organization,
  )
}

export async function refreshAuthTokens(refreshToken: string): Promise<AuthTokenRefreshPayload> {
  const authClient = getSupabaseAuthClient()
  const { data, error } = await authClient.auth.refreshSession({
    refresh_token: refreshToken,
  })

  if (error !== null || data.session === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token')
  }

  const userId = data.user?.id ?? data.session.user.id
  const organization = await authRepository.findOrganizationById(userId)
  if (organization === null) {
    throw new AppError(403, 'FORBIDDEN', 'No account profile found. Please register first.')
  }

  return {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn: data.session.expires_in ?? 3600,
  }
}

export async function loginOrganization(input: LoginBody): Promise<AuthSessionPayload> {
  const normalizedEmail = input.email
  const authClient = getSupabaseAuthClient()
  const { data, error } = await authClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: input.password,
  })

  if (error !== null) {
    if (isSupabaseEmailNotConfirmedError(error.message)) {
      throw new AppError(
        403,
        'EMAIL_NOT_VERIFIED',
        'Please verify your email first. Check your inbox for the verification code.',
      )
    }

    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

  if (data.session === null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

  const organization = await authRepository.findOrganizationById(data.user.id)
  if (organization === null) {
    throw new AppError(403, 'FORBIDDEN', 'No account profile found. Please register first.')
  }

  if (!organization.email_verified) {
    throw new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email first. Check your inbox for the verification code.',
    )
  }

  return buildSessionPayload(
    data.session.access_token,
    data.session.refresh_token,
    data.session.expires_in ?? 3600,
    organization,
  )
}

export async function getCurrentOrganization(auth: AuthContext): Promise<AuthSessionPayload> {
  const organization = await authRepository.findOrganizationById(auth.organizationId)
  if (organization === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Organization account not found')
  }

  return buildProfilePayload(organization)
}

async function buildProfilePayload(organization: OrganizationRecord): Promise<AuthSessionPayload> {
  const subscription = await getSubscriptionForOrganization(organization.id)
  const businessDetails = await authRepository.findBusinessDetailsStatus(organization.id)

  return {
    accessToken: '',
    refreshToken: '',
    expiresIn: 0,
    organization: await buildOrganizationSummary(organization),
    subscription,
    businessDetails: {
      completed:
        businessDetails?.completed_at !== null && businessDetails?.completed_at !== undefined,
      completedAt: businessDetails?.completed_at ?? null,
    },
  }
}

export async function updateProfile(
  auth: AuthContext,
  input: UpdateProfileBody,
  accessToken: string,
): Promise<AuthSessionPayload> {
  const patch: authRepository.OrganizationProfilePatch = {}

  if (input.name !== undefined) {
    patch.name = input.name
  }

  if (input.preferredTranslationLanguage !== undefined) {
    patch.preferred_translation_language = input.preferredTranslationLanguage
  }

  if (input.agentEnabled === true) {
    await assertCanEnableBusinessAgent(auth.organizationId)
  }

  if (input.agentEnabled !== undefined) {
    patch.agent_enabled = input.agentEnabled
  }

  const organization = await authRepository.updateOrganizationProfile(auth.organizationId, patch)

  if (input.name !== undefined) {
    const admin = getSupabaseAdminClient()
    const { error } = await admin.auth.admin.updateUserById(auth.organizationId, {
      user_metadata: {
        organization_name: input.name,
      },
    })

    if (error !== null) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to sync account profile')
    }
  }

  await authCache.setCachedAuthContext(accessToken, toAuthContext(organization))

  return buildProfilePayload(organization)
}

export function listTranslationLanguages() {
  return { languages: TRANSLATION_LANGUAGES }
}

export async function changePassword(
  auth: AuthContext,
  input: ChangePasswordBody,
  accessToken: string,
): Promise<void> {
  const organization = await authRepository.findOrganizationById(auth.organizationId)
  if (organization === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Organization account not found')
  }

  const authClient = getSupabaseAuthClient()
  const { error: signInError } = await authClient.auth.signInWithPassword({
    email: organization.email,
    password: input.currentPassword,
  })

  if (signInError !== null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Current password is incorrect')
  }

  const admin = getSupabaseAdminClient()
  const { error: updateError } = await admin.auth.admin.updateUserById(auth.organizationId, {
    password: input.newPassword,
  })

  if (updateError !== null) {
    throw new AppError(400, 'BAD_REQUEST', updateError.message)
  }

  await authCache.invalidateAuthContextCache(accessToken)
}
