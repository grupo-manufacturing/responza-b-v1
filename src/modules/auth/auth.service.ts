import type { User } from '@supabase/supabase-js'
import { z } from 'zod'

import {
  type AuthContext,
  type AuthSessionPayload,
} from '../../shared/auth/index.js'
import { getAuthEmailRedirectUrl, loadEnv } from '../../shared/config/index.js'
import { getSupabaseAdminClient, getSupabaseAuthClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import { getSubscriptionForOrganization } from '../subscription/subscription.service.js'
import { TRANSLATION_LANGUAGES } from '../ai/ai.constants.js'
import * as authRepository from './auth.repository.js'
import { translationLanguageSchema } from '../ai/ai.schemas.js'
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

export const resendVerificationBodySchema = z.object({
  email: emailFieldSchema,
})

export const googleCallbackBodySchema = z.object({
  accessToken: z.string().trim().min(1),
  refreshToken: z.string().trim().min(1),
  expiresIn: z.coerce.number().int().positive().optional(),
})

export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    preferredTranslationLanguage: translationLanguageSchema.nullable().optional(),
  })
  .refine(
    (body) => body.name !== undefined || body.preferredTranslationLanguage !== undefined,
    { message: 'At least one field is required' },
  )

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
export type ResendVerificationBody = z.infer<typeof resendVerificationBodySchema>
export type GoogleCallbackBody = z.infer<typeof googleCallbackBodySchema>
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>

export type RegisterOrganizationResult =
  | {
      readonly requiresEmailVerification: true
      readonly email: string
    }
  | {
      readonly requiresEmailVerification: false
      readonly session: AuthSessionPayload
    }

function toAuthContext(organization: Pick<OrganizationRecord, 'id' | 'email' | 'name'>): AuthContext {
  return {
    organizationId: organization.id,
    email: organization.email,
    name: organization.name,
  }
}

function toOrganizationSummary(organization: OrganizationRecord) {
  return {
    id: organization.id,
    email: organization.email,
    name: organization.name,
    plan: organization.plan,
    preferredTranslationLanguage: organization.preferred_translation_language ?? null,
  }
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
    organization: toOrganizationSummary(organization),
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
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.getUser(accessToken)

  if (error !== null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token')
  }

  return loadAuthContext(data.user.id)
}

function isGoogleAuthUser(user: User): boolean {
  if (user.app_metadata.provider === 'google') {
    return true
  }

  return user.identities?.some((identity) => identity.provider === 'google') ?? false
}

function isEmailVerified(user: User): boolean {
  return user.email_confirmed_at !== null && user.email_confirmed_at !== undefined
}

function assertEmailVerified(user: User): void {
  if (!isEmailVerified(user)) {
    throw new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email before signing in. Check your inbox for the confirmation link.',
    )
  }
}

function mapSignInError(errorMessage: string): AppError {
  const normalized = errorMessage.toLowerCase()

  if (normalized.includes('email not confirmed') || normalized.includes('email not verified')) {
    return new AppError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Please verify your email before signing in. Check your inbox for the confirmation link.',
    )
  }

  return new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
}

function deriveOrganizationName(user: User, email: string): string {
  const metadata = user.user_metadata
  const fullName =
    typeof metadata.full_name === 'string'
      ? metadata.full_name.trim()
      : typeof metadata.name === 'string'
        ? metadata.name.trim()
        : ''

  if (fullName.length > 0) {
    return fullName.slice(0, 160)
  }

  const localPart = email.split('@')[0] ?? 'workspace'
  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 160)
}

export async function registerOrganization(input: RegisterBody): Promise<RegisterOrganizationResult> {
  const normalizedEmail = input.email
  const existing = await authRepository.findOrganizationByEmail(normalizedEmail)
  if (existing !== null) {
    throw new AppError(409, 'CONFLICT', 'An account with this email already exists')
  }

  const env = loadEnv()
  const emailRedirectTo = getAuthEmailRedirectUrl(env)
  const authClient = getSupabaseAuthClient()
  const { data, error } = await authClient.auth.signUp({
    email: normalizedEmail,
    password: input.password,
    options: {
      data: {
        organization_name: input.name,
      },
      emailRedirectTo,
    },
  })

  if (error !== null) {
    if (error.message.toLowerCase().includes('already')) {
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
  })
  await authRepository.createBusinessProfile(organization.id)

  if (data.session !== null && isEmailVerified(data.user)) {
    return {
      requiresEmailVerification: false,
      session: await buildSessionPayload(
        data.session.access_token,
        data.session.refresh_token,
        data.session.expires_in ?? 3600,
        organization,
      ),
    }
  }

  return {
    requiresEmailVerification: true,
    email: normalizedEmail,
  }
}

export async function resendVerificationEmail(input: ResendVerificationBody): Promise<void> {
  const organization = await authRepository.findOrganizationByEmail(input.email)
  if (organization === null) {
    return
  }

  const env = loadEnv()
  const authClient = getSupabaseAuthClient()
  const { error } = await authClient.auth.resend({
    type: 'signup',
    email: input.email,
    options: {
      emailRedirectTo: getAuthEmailRedirectUrl(env),
    },
  })

  if (error !== null) {
    throw new AppError(400, 'BAD_REQUEST', error.message)
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
    throw mapSignInError(error.message)
  }

  if (data.session === null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

  assertEmailVerified(data.user)

  const organization = await authRepository.findOrganizationById(data.user.id)
  if (organization === null) {
    throw new AppError(403, 'FORBIDDEN', 'No account profile found. Please register first.')
  }

  return buildSessionPayload(
    data.session.access_token,
    data.session.refresh_token,
    data.session.expires_in ?? 3600,
    organization,
  )
}

export async function completeGoogleSignIn(input: GoogleCallbackBody): Promise<AuthSessionPayload> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.getUser(input.accessToken)

  if (error !== null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired Google sign-in session')
  }

  if (!isGoogleAuthUser(data.user)) {
    throw new AppError(400, 'BAD_REQUEST', 'Sign-in provider must be Google')
  }

  const rawEmail = data.user.email
  if (rawEmail === null || rawEmail === undefined || rawEmail.trim().length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Google account did not return an email address')
  }

  const normalizedEmail = rawEmail.trim().toLowerCase()

  let organization = await authRepository.findOrganizationById(data.user.id)

  if (organization === null) {
    const existingByEmail = await authRepository.findOrganizationByEmail(normalizedEmail)
    if (existingByEmail !== null && existingByEmail.id !== data.user.id) {
      throw new AppError(
        409,
        'CONFLICT',
        'An account with this email already exists. Sign in with email and password instead.',
      )
    }

    organization = await authRepository.createOrganization({
      id: data.user.id,
      email: normalizedEmail,
      name: deriveOrganizationName(data.user, normalizedEmail),
    })
    await authRepository.createBusinessProfile(organization.id)
  }

  return buildSessionPayload(
    input.accessToken,
    input.refreshToken,
    input.expiresIn ?? 3600,
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
    organization: toOrganizationSummary(organization),
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
): Promise<AuthSessionPayload> {
  const patch: authRepository.OrganizationProfilePatch = {}

  if (input.name !== undefined) {
    patch.name = input.name
  }

  if (input.preferredTranslationLanguage !== undefined) {
    patch.preferred_translation_language = input.preferredTranslationLanguage
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

  return buildProfilePayload(organization)
}

export function listTranslationLanguages() {
  return { languages: TRANSLATION_LANGUAGES }
}

export async function changePassword(
  auth: AuthContext,
  input: ChangePasswordBody,
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
}
