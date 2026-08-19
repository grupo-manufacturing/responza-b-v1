import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { IntegrationPlatform } from '../integrations/integrations.constants.js'

export type AdminOrganizationRecord = {
  id: string
  email: string
  name: string
  plan: string
  subscription_status: string
  trial_started_at: string
  trial_ends_at: string
  subscription_period_starts_at: string | null
  subscription_period_ends_at: string | null
  razorpay_customer_id: string | null
  razorpay_subscription_id: string | null
  conversation_limit: number | null
  email_verified: boolean
  created_at: string
}

export type AdminOrganizationSubscriptionSnapshot = Pick<
  AdminOrganizationRecord,
  | 'subscription_status'
  | 'trial_started_at'
  | 'trial_ends_at'
  | 'subscription_period_starts_at'
  | 'subscription_period_ends_at'
  | 'conversation_limit'
  | 'razorpay_customer_id'
  | 'razorpay_subscription_id'
>

export type AdminIntegrationRecord = {
  organization_id: string
  platform: IntegrationPlatform
}

const ADMIN_ORG_COLUMNS =
  'id, email, name, plan, subscription_status, trial_started_at, trial_ends_at, subscription_period_starts_at, subscription_period_ends_at, razorpay_customer_id, razorpay_subscription_id, conversation_limit, email_verified, created_at'

const SUBSCRIPTION_SNAPSHOT_COLUMNS =
  'subscription_status, trial_started_at, trial_ends_at, subscription_period_starts_at, subscription_period_ends_at, conversation_limit, razorpay_customer_id, razorpay_subscription_id'

export async function listOrganizationSubscriptionSnapshotsForAdmin(): Promise<
  AdminOrganizationSubscriptionSnapshot[]
> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('organizations').select(SUBSCRIPTION_SNAPSHOT_COLUMNS)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load organization subscription snapshots')
  }

  return (data ?? []) as AdminOrganizationSubscriptionSnapshot[]
}

export async function listOrganizationsForAdmin(input: {
  page: number
  limit: number
}): Promise<{ organizations: AdminOrganizationRecord[]; total: number }> {
  const offset = (input.page - 1) * input.limit
  const client = getSupabaseAdminClient()
  const { data, error, count } = await client
    .from('organizations')
    .select(ADMIN_ORG_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + input.limit - 1)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list organizations')
  }

  return {
    organizations: (data ?? []) as AdminOrganizationRecord[],
    total: count ?? 0,
  }
}

export async function listConnectedIntegrationsForOrganizations(
  organizationIds: string[],
): Promise<AdminIntegrationRecord[]> {
  if (organizationIds.length === 0) {
    return []
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select('organization_id, platform')
    .eq('status', 'connected')
    .in('organization_id', organizationIds)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list integrations')
  }

  return (data ?? []) as AdminIntegrationRecord[]
}

export async function countConversationsCreatedSince(sinceIso: string): Promise<number> {
  const client = getSupabaseAdminClient()
  const { count, error } = await client
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count conversations')
  }

  return count ?? 0
}
