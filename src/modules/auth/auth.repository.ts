import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { OrganizationRecord } from '../subscription/subscription.repository.js'

const ORGANIZATION_COLUMNS =
  'id, email, name, plan, subscription_status, trial_started_at, trial_ends_at, subscription_period_ends_at, preferred_translation_language'

type BusinessProfileRow = {
  organization_id: string
  completed_at: string | null
}

function addDays(from: Date, days: number): Date {
  const result = new Date(from)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export async function findOrganizationById(organizationId: string): Promise<OrganizationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select(ORGANIZATION_COLUMNS)
    .eq('id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load organization account')
  }

  return data as OrganizationRecord | null
}

export async function findOrganizationByEmail(email: string): Promise<OrganizationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select(ORGANIZATION_COLUMNS)
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load organization account')
  }

  return data as OrganizationRecord | null
}

export async function findBusinessDetailsStatus(organizationId: string): Promise<BusinessProfileRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_business_profiles')
    .select('organization_id, completed_at')
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load business details status')
  }

  return data as BusinessProfileRow | null
}

export async function createOrganization(input: {
  id: string
  email: string
  name: string
}): Promise<OrganizationRecord> {
  const env = loadEnv()
  const now = new Date()
  const trialEndsAt = addDays(now, env.TRIAL_DURATION_DAYS)

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .insert({
      id: input.id,
      email: input.email.toLowerCase(),
      name: input.name,
      plan: 'free',
      subscription_status: 'trialing',
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
    })
    .select(ORGANIZATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    if (error?.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'An account with this email already exists')
    }

    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create organization account')
  }

  return data as OrganizationRecord
}

export type OrganizationProfilePatch = {
  name?: string
  preferred_translation_language?: string | null
}

export async function updateOrganizationProfile(
  organizationId: string,
  patch: OrganizationProfilePatch,
): Promise<OrganizationRecord> {
  const payload: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  }

  if (patch.name !== undefined) {
    payload.name = patch.name
  }

  if (patch.preferred_translation_language !== undefined) {
    payload.preferred_translation_language = patch.preferred_translation_language
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .update(payload)
    .eq('id', organizationId)
    .select(ORGANIZATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update organization profile')
  }

  return data as OrganizationRecord
}

export async function updateOrganizationName(
  organizationId: string,
  name: string,
): Promise<OrganizationRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select(ORGANIZATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update organization name')
  }

  return data as OrganizationRecord
}

export async function createBusinessProfile(organizationId: string): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('organization_business_profiles').insert({
    organization_id: organizationId,
  })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create business details profile')
  }
}
