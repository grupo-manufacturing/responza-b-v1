import {
  getCachedAuthContext,
  invalidateAuthContextCache,
  setCachedAuthContext,
  type AuthContext,
  type AuthSessionPayload,
} from '../../shared/auth/index.js'
import { getSupabaseAdminClient, getSupabaseAuthClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import { getSubscriptionForOrganization } from '../subscription/subscription.service.js'
import type { LoginBody, RegisterBody } from './auth.schemas.js'
import * as authRepository from './auth.repository.js'
import type { OrganizationRecord } from '../subscription/subscription.repository.js'

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
  }
}

async function buildSessionPayload(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  organization: OrganizationRecord,
): Promise<AuthSessionPayload> {
  const auth = toAuthContext(organization)
  const [businessDetails, subscription] = await Promise.all([
    authRepository.findBusinessDetailsStatus(organization.id),
    getSubscriptionForOrganization(organization.id),
  ])

  await setCachedAuthContext(auth)

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
  const cached = await getCachedAuthContext(organizationId)
  if (cached !== null) {
    return cached
  }

  const organization = await authRepository.findOrganizationById(organizationId)
  if (organization === null) {
    throw new AppError(403, 'FORBIDDEN', 'No account found. Please register first.')
  }

  const context = toAuthContext(organization)
  await setCachedAuthContext(context)
  return context
}

export async function resolveAuthContextFromAccessToken(accessToken: string): Promise<AuthContext> {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.getUser(accessToken)

  if (error !== null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token')
  }

  return loadAuthContext(data.user.id)
}

export async function registerOrganization(input: RegisterBody): Promise<AuthSessionPayload> {
  const normalizedEmail = input.email.toLowerCase()
  const existing = await authRepository.findOrganizationByEmail(normalizedEmail)
  if (existing !== null) {
    throw new AppError(409, 'CONFLICT', 'An account with this email already exists')
  }

  const admin = getSupabaseAdminClient()
  const { data: createdAuth, error: createError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      organization_name: input.name,
    },
  })

  if (createError !== null || createdAuth.user === null) {
    if (createError?.message.toLowerCase().includes('already')) {
      throw new AppError(409, 'CONFLICT', 'An account with this email already exists')
    }

    throw new AppError(400, 'BAD_REQUEST', createError?.message ?? 'Failed to create auth user')
  }

  const organization = await authRepository.createOrganization({
    id: createdAuth.user.id,
    email: normalizedEmail,
    name: input.name,
  })
  await authRepository.createBusinessProfile(organization.id)

  const authClient = getSupabaseAuthClient()
  const { data: session, error: signInError } = await authClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: input.password,
  })

  if (signInError !== null || session.session === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Account created but sign-in failed')
  }

  return buildSessionPayload(
    session.session.access_token,
    session.session.refresh_token,
    session.session.expires_in ?? 3600,
    organization,
  )
}

export async function loginOrganization(input: LoginBody): Promise<AuthSessionPayload> {
  const normalizedEmail = input.email.toLowerCase()
  const authClient = getSupabaseAuthClient()
  const { data, error } = await authClient.auth.signInWithPassword({
    email: normalizedEmail,
    password: input.password,
  })

  if (error !== null || data.session === null || data.user === null) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid email or password')
  }

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

export async function getCurrentOrganization(auth: AuthContext): Promise<AuthSessionPayload> {
  const organization = await authRepository.findOrganizationById(auth.organizationId)
  if (organization === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Organization account not found')
  }

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

export async function invalidateOrganizationAuthCache(organizationId: string): Promise<void> {
  await invalidateAuthContextCache(organizationId)
}
