import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { OrganizationSubscriptionRecord } from '../../shared/subscription/index.js'

export type OrganizationRecord = OrganizationSubscriptionRecord & {
  id: string
  email: string
  name: string
  plan: string
  preferred_translation_language: string | null
  email_verified: boolean
}

export const ORGANIZATION_COLUMNS =
  'id, email, name, plan, subscription_status, trial_started_at, trial_ends_at, subscription_period_starts_at, subscription_period_ends_at, preferred_translation_language, razorpay_customer_id, razorpay_subscription_id, conversation_limit, email_verified'

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

export async function updateRazorpayCustomerId(
  organizationId: string,
  razorpayCustomerId: string,
): Promise<OrganizationRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .update({
      razorpay_customer_id: razorpayCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select(ORGANIZATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update Razorpay customer')
  }

  return data as OrganizationRecord
}

export async function updateRazorpaySubscriptionId(
  organizationId: string,
  razorpaySubscriptionId: string,
): Promise<OrganizationRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .update({
      razorpay_subscription_id: razorpaySubscriptionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select(ORGANIZATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update Razorpay subscription')
  }

  return data as OrganizationRecord
}

export async function findOrganizationByRazorpayCustomerId(
  razorpayCustomerId: string,
): Promise<OrganizationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select(ORGANIZATION_COLUMNS)
    .eq('razorpay_customer_id', razorpayCustomerId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load organization by Razorpay customer')
  }

  return data as OrganizationRecord | null
}

export async function findOrganizationByRazorpaySubscriptionId(
  razorpaySubscriptionId: string,
): Promise<OrganizationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select(ORGANIZATION_COLUMNS)
    .eq('razorpay_subscription_id', razorpaySubscriptionId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load organization by Razorpay subscription')
  }

  return data as OrganizationRecord | null
}

export type ApplySubscriptionBillingStateInput = {
  organizationId: string
  subscriptionStatus: 'trialing' | 'active' | 'expired'
  plan?: string
  conversationLimit?: number | null
  subscriptionPeriodStartsAt?: string | null
  subscriptionPeriodEndsAt?: string | null
  trialEndsAt?: string | null
  razorpayCustomerId?: string | null
  razorpaySubscriptionId?: string | null
}

export async function applySubscriptionBillingState(
  input: ApplySubscriptionBillingStateInput,
): Promise<OrganizationRecord> {
  const client = getSupabaseAdminClient()
  const update: Record<string, unknown> = {
    subscription_status: input.subscriptionStatus,
    updated_at: new Date().toISOString(),
  }

  if (input.plan !== undefined) {
    update.plan = input.plan
  }

  if (input.conversationLimit !== undefined) {
    update.conversation_limit = input.conversationLimit
  }

  if (input.subscriptionPeriodStartsAt !== undefined) {
    update.subscription_period_starts_at = input.subscriptionPeriodStartsAt
  }

  if (input.subscriptionPeriodEndsAt !== undefined) {
    update.subscription_period_ends_at = input.subscriptionPeriodEndsAt
  }

  if (input.trialEndsAt !== undefined) {
    update.trial_ends_at = input.trialEndsAt
  }

  if (input.razorpayCustomerId !== undefined) {
    update.razorpay_customer_id = input.razorpayCustomerId
  }

  if (input.razorpaySubscriptionId !== undefined) {
    update.razorpay_subscription_id = input.razorpaySubscriptionId
  }

  const { data, error } = await client
    .from('organizations')
    .update(update)
    .eq('id', input.organizationId)
    .select(ORGANIZATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update subscription billing state')
  }

  return data as OrganizationRecord
}
