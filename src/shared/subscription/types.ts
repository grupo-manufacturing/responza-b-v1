export const SUBSCRIPTION_STATUSES = ['trialing', 'active', 'expired'] as const

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export type OrganizationSubscriptionRecord = {
  readonly subscription_status: SubscriptionStatus
  readonly trial_started_at: string
  readonly trial_ends_at: string
  readonly subscription_period_ends_at: string | null
  readonly subscription_period_starts_at: string | null
  readonly razorpay_customer_id: string | null
  readonly razorpay_subscription_id: string | null
  readonly conversation_limit: number | null
}

export type SubscriptionAccess = {
  readonly status: SubscriptionStatus
  readonly hasAccess: boolean
  readonly isTrialing: boolean
  readonly isPaid: boolean
  readonly trialEndsAt: string
  readonly subscriptionPeriodEndsAt: string | null
  readonly daysRemainingInTrial: number | null
  readonly requiresPayment: boolean
}
