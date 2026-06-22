import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import { resolveEffectiveSubscriptionStatus } from '../../shared/subscription/index.js'
import type { OrganizationRecord } from '../subscription/subscription.repository.js'
import * as subscriptionRepository from '../subscription/subscription.repository.js'
import type { BillingPlan } from './billing.plans.js'
import type { BillingPlanKey } from './billing.plans.js'
import { isRazorpayBillingConfigured, resolveBillingPlan } from './billing.plans.js'
import * as razorpayClient from './razorpay.client.js'
import type { RazorpaySubscription } from './razorpay.types.js'

const PENDING_CHECKOUT_STATUSES = new Set(['created', 'authenticated', 'pending'])

function assertBillingReady(): void {
  if (!isRazorpayBillingConfigured(loadEnv())) {
    throw new AppError(503, 'BILLING_NOT_CONFIGURED', 'Razorpay billing is not fully configured.')
  }
}

export async function ensureRazorpayCustomer(
  organization: OrganizationRecord,
): Promise<OrganizationRecord> {
  assertBillingReady()

  if (organization.razorpay_customer_id !== null) {
    return organization
  }

  const customer = await razorpayClient.createCustomer({
    name: organization.name,
    email: organization.email,
    organizationId: organization.id,
  })

  return subscriptionRepository.updateRazorpayCustomerId(organization.id, customer.id)
}

function resolveSubscriptionStartAt(organization: OrganizationRecord): Date | undefined {
  const now = new Date()
  const status = resolveEffectiveSubscriptionStatus(organization, now)

  if (status === 'trialing' && new Date(organization.trial_ends_at) > now) {
    return new Date(organization.trial_ends_at)
  }

  return undefined
}

function buildCheckoutResult(input: {
  organization: OrganizationRecord
  plan: BillingPlan
  subscription: RazorpaySubscription
}) {
  return {
    organization: input.organization,
    plan: input.plan,
    subscription: input.subscription,
    checkout: {
      keyId: razorpayClient.getRazorpayKeyId(),
      subscriptionId: input.subscription.id,
      shortUrl: input.subscription.short_url,
      status: input.subscription.status,
      startAt: input.subscription.start_at,
    },
  }
}

async function tryReusePendingCheckout(input: {
  organization: OrganizationRecord
  plan: BillingPlan
}): Promise<ReturnType<typeof buildCheckoutResult> | null> {
  if (input.organization.razorpay_subscription_id === null) {
    return null
  }

  const existing = await razorpayClient.fetchSubscription(input.organization.razorpay_subscription_id)
  if (!PENDING_CHECKOUT_STATUSES.has(existing.status)) {
    return null
  }

  if (existing.plan_id !== input.plan.razorpayPlanId) {
    return null
  }

  return buildCheckoutResult({
    organization: input.organization,
    plan: input.plan,
    subscription: existing,
  })
}

export async function createCheckoutSubscription(input: {
  organizationId: string
  planKey: BillingPlanKey
}) {
  assertBillingReady()

  const env = loadEnv()
  const plan = resolveBillingPlan(env, input.planKey)
  const organization = await subscriptionRepository.findOrganizationById(input.organizationId)

  if (organization === null) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found')
  }

  const status = resolveEffectiveSubscriptionStatus(organization)
  if (status === 'active') {
    throw new AppError(409, 'CONFLICT', 'Organization already has an active subscription.')
  }

  const organizationWithCustomer = await ensureRazorpayCustomer(organization)
  const reused = await tryReusePendingCheckout({
    organization: organizationWithCustomer,
    plan,
  })

  if (reused !== null) {
    return reused
  }

  const startAt = resolveSubscriptionStartAt(organizationWithCustomer)

  const subscription = await razorpayClient.createSubscription({
    planId: plan.razorpayPlanId,
    customerId: organizationWithCustomer.razorpay_customer_id!,
    organizationId: organizationWithCustomer.id,
    planKey: plan.key,
    startAt,
  })

  const updated = await subscriptionRepository.updateRazorpaySubscriptionId(
    organizationWithCustomer.id,
    subscription.id,
  )

  return buildCheckoutResult({
    organization: updated,
    plan,
    subscription,
  })
}

export async function cancelOrganizationSubscription(
  organizationId: string,
  cancelAtCycleEnd = true,
) {
  assertBillingReady()

  const organization = await subscriptionRepository.findOrganizationById(organizationId)
  if (organization === null) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found')
  }

  if (organization.razorpay_subscription_id === null) {
    throw new AppError(404, 'NOT_FOUND', 'No Razorpay subscription found for this organization.')
  }

  const subscription = await razorpayClient.cancelSubscription({
    subscriptionId: organization.razorpay_subscription_id,
    cancelAtCycleEnd,
  })

  return { organization, subscription }
}

export async function getOrganizationRazorpaySubscription(organizationId: string) {
  assertBillingReady()

  const organization = await subscriptionRepository.findOrganizationById(organizationId)
  if (organization === null) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found')
  }

  if (organization.razorpay_subscription_id === null) {
    throw new AppError(404, 'NOT_FOUND', 'No Razorpay subscription found for this organization.')
  }

  const subscription = await razorpayClient.fetchSubscription(organization.razorpay_subscription_id)
  return { organization, subscription }
}
