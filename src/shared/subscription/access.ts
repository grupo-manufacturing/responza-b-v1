import type { OrganizationSubscriptionRecord, SubscriptionAccess, SubscriptionStatus } from './types.js'

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86_400_000
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / msPerDay))
}

export function resolveEffectiveSubscriptionStatus(
  record: OrganizationSubscriptionRecord,
  now: Date = new Date(),
): SubscriptionStatus {
  if (record.subscription_status === 'active') {
    if (
      record.subscription_period_ends_at !== null &&
      new Date(record.subscription_period_ends_at) <= now
    ) {
      return 'expired'
    }

    return 'active'
  }

  if (record.subscription_status === 'trialing' && new Date(record.trial_ends_at) <= now) {
    return 'expired'
  }

  if (record.subscription_status === 'trialing') {
    return 'trialing'
  }

  return 'expired'
}

export function resolveSubscriptionAccess(
  record: OrganizationSubscriptionRecord,
  now: Date = new Date(),
): SubscriptionAccess {
  const status = resolveEffectiveSubscriptionStatus(record, now)
  const trialEndsAt = new Date(record.trial_ends_at)
  const hasAccess = status === 'trialing' || status === 'active'

  return {
    status,
    hasAccess,
    isTrialing: status === 'trialing',
    isPaid: status === 'active',
    trialEndsAt: record.trial_ends_at,
    subscriptionPeriodEndsAt: record.subscription_period_ends_at,
    daysRemainingInTrial:
      status === 'trialing' ? daysBetween(now, trialEndsAt) : null,
    requiresPayment: status === 'expired',
  }
}

export function toSubscriptionResponse(
  record: OrganizationSubscriptionRecord,
  plan: string,
  now: Date = new Date(),
) {
  const access = resolveSubscriptionAccess(record, now)

  return {
    plan,
    status: access.status,
    hasAccess: access.hasAccess,
    isTrialing: access.isTrialing,
    isPaid: access.isPaid,
    trialStartedAt: record.trial_started_at,
    trialEndsAt: access.trialEndsAt,
    subscriptionPeriodEndsAt: access.subscriptionPeriodEndsAt,
    daysRemainingInTrial: access.daysRemainingInTrial,
    requiresPayment: access.requiresPayment,
  }
}
