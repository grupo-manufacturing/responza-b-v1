import { loadEnv } from '../../shared/config/index.js'
import type { OrganizationRecord } from '../subscription/subscription.repository.js'
import * as subscriptionRepository from '../subscription/subscription.repository.js'
import {
  getBillingPlanCatalogEntry,
  isBillingPlanKey,
  resolveBillingPlanKeyByRazorpayPlanId,
  type BillingPlanKey,
} from './billing.plans.js'
import type { RazorpaySubscription } from './razorpay.types.js'

function unixToIso(unix: number | null | undefined): string | null {
  if (unix === null || unix === undefined) {
    return null
  }

  return new Date(unix * 1000).toISOString()
}

export function readNoteValue(notes: Record<string, string> | null | undefined, key: string): string | null {
  const value = notes?.[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  return value.trim()
}

export function resolvePlanKeyFromSubscription(subscription: RazorpaySubscription): BillingPlanKey | null {
  const env = loadEnv()
  const fromNotes = readNoteValue(subscription.notes, 'plan_key')
  if (fromNotes !== null && isBillingPlanKey(fromNotes)) {
    return fromNotes
  }

  return resolveBillingPlanKeyByRazorpayPlanId(env, subscription.plan_id)
}

export function resolveBillingPeriodFromSubscription(subscription: RazorpaySubscription): {
  startsAt: string | null
  endsAt: string | null
} {
  return {
    startsAt: unixToIso(subscription.current_start) ?? unixToIso(subscription.start_at),
    endsAt: unixToIso(subscription.current_end) ?? unixToIso(subscription.end_at),
  }
}

function shouldEndTrialOnPaidActivation(organization: OrganizationRecord, now = new Date()): boolean {
  return (
    organization.subscription_status === 'trialing' && new Date(organization.trial_ends_at) > now
  )
}

const PAID_RAZORPAY_SUBSCRIPTION_STATUSES = new Set(['active', 'authenticated'])

export function isPaidRazorpaySubscription(subscription: RazorpaySubscription): boolean {
  return PAID_RAZORPAY_SUBSCRIPTION_STATUSES.has(subscription.status)
}

export async function applyActiveSubscriptionFromRazorpay(
  organization: OrganizationRecord,
  subscription: RazorpaySubscription,
  planKey: BillingPlanKey | null,
): Promise<OrganizationRecord> {
  const now = new Date()
  const { startsAt, endsAt } = resolveBillingPeriodFromSubscription(subscription)

  return subscriptionRepository.applySubscriptionBillingState({
    organizationId: organization.id,
    subscriptionStatus: 'active',
    plan: planKey ?? organization.plan,
    conversationLimit: planKey ? getBillingPlanCatalogEntry(planKey).conversationLimit : undefined,
    subscriptionPeriodStartsAt: startsAt,
    subscriptionPeriodEndsAt: endsAt,
    trialEndsAt: shouldEndTrialOnPaidActivation(organization, now) ? now.toISOString() : undefined,
    razorpayCustomerId: subscription.customer_id,
    razorpaySubscriptionId: subscription.id,
  })
}
