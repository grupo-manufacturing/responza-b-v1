import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { OrganizationSubscriptionRecord } from '../../shared/subscription/index.js'

export type OrganizationRecord = OrganizationSubscriptionRecord & {
  id: string
  email: string
  name: string
  plan: string
}

const ORGANIZATION_COLUMNS =
  'id, email, name, plan, subscription_status, trial_started_at, trial_ends_at, subscription_period_ends_at'

export async function findOrganizationById(organizationId: string): Promise<OrganizationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select(ORGANIZATION_COLUMNS)
    .eq('id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load organization subscription')
  }

  return data as OrganizationRecord | null
}

export async function activatePaidSubscription(
  organizationId: string,
  periodEndsAt: string,
): Promise<OrganizationRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .update({
      subscription_status: 'active',
      plan: 'pro',
      subscription_period_ends_at: periodEndsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select(ORGANIZATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to activate subscription')
  }

  return data as OrganizationRecord
}

export async function markSubscriptionExpired(organizationId: string): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('organizations')
    .update({
      subscription_status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update subscription status')
  }
}
