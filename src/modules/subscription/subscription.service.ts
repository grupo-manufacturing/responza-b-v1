import { loadEnv } from '../../shared/config/index.js'
import { resolveEffectiveSubscriptionStatus, toSubscriptionResponse } from '../../shared/subscription/index.js'
import { AppError } from '../../shared/errors/index.js'
import {
  getBillingPlanCatalogEntry,
  getRazorpayKeyMode,
  isRazorpayBillingConfigured,
  isRazorpayConfigured,
  listBillingPlansPublic,
  toBillingPlanPublic,
  type BillingPlanKey,
} from '../razorpay/billing.plans.js'
import * as razorpayBilling from '../razorpay/razorpay.billing.js'
import * as subscriptionCache from './subscription.cache.js'
import type { SubscriptionCachePayload } from './subscription.cache.js'
import * as subscriptionRepository from './subscription.repository.js'
import * as usageService from './usage.service.js'

async function loadSubscriptionForOrganization(
  organizationId: string,
): Promise<SubscriptionCachePayload> {
  const organization = await subscriptionRepository.findOrganizationById(organizationId)
  if (organization === null) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found')
  }

  const now = new Date()
  const effectiveStatus = resolveEffectiveSubscriptionStatus(organization, now)

  if (
    effectiveStatus === 'expired' &&
    organization.subscription_status !== 'expired'
  ) {
    await subscriptionRepository.markSubscriptionExpired(organizationId)
    await subscriptionCache.invalidateSubscriptionCache(organizationId)
  }

  const refreshed =
    effectiveStatus === 'expired' && organization.subscription_status !== 'expired'
      ? await subscriptionRepository.findOrganizationById(organizationId)
      : organization

  if (refreshed === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load subscription')
  }

  const usage = await usageService.getConversationUsageSummary(refreshed)

  return {
    ...toSubscriptionResponse(refreshed, refreshed.plan, now),
    ...usage,
  }
}

export async function getSubscriptionForOrganization(organizationId: string) {
  const cached = await subscriptionCache.getCachedSubscription(organizationId)
  if (cached !== null) {
    return cached
  }

  const subscription = await loadSubscriptionForOrganization(organizationId)
  await subscriptionCache.setCachedSubscription(organizationId, subscription)
  return subscription
}

export function getBillingPlansCatalog() {
  const env = loadEnv()

  return {
    plans: listBillingPlansPublic(),
    razorpayConfigured: isRazorpayConfigured(env),
    checkoutAvailable: isRazorpayBillingConfigured(env),
    razorpayMode: getRazorpayKeyMode(env),
  }
}

export async function createSubscriptionCheckout(organizationId: string, planKey: BillingPlanKey) {
  const result = await razorpayBilling.createCheckoutSubscription({
    organizationId,
    planKey,
  })

  return {
    checkout: result.checkout,
    plan: toBillingPlanPublic(getBillingPlanCatalogEntry(planKey)),
  }
}

export async function cancelSubscription(organizationId: string, cancelAtCycleEnd: boolean) {
  const result = await razorpayBilling.cancelOrganizationSubscription(
    organizationId,
    cancelAtCycleEnd,
  )

  await subscriptionCache.invalidateSubscriptionCache(organizationId)

  return {
    razorpayStatus: result.subscription.status,
    cancelAtCycleEnd,
  }
}

export async function syncSubscriptionFromRazorpay(organizationId: string) {
  const updated = await razorpayBilling.syncOrganizationSubscriptionFromRazorpay(organizationId)
  const usage = await usageService.getConversationUsageSummary(updated)

  const subscription = {
    ...toSubscriptionResponse(updated, updated.plan),
    ...usage,
  }

  await subscriptionCache.setCachedSubscription(organizationId, subscription)
  return subscription
}
