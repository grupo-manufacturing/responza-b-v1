import { loadEnv } from '../../shared/config/index.js'
import { deleteCached, getCachedJson, setCachedJson } from '../../shared/redis/cache.js'
import { buildCacheKey, CACHE_NAMESPACES } from '../../shared/redis/keys.js'
import type { ConversationUsageSummary } from './usage.service.js'

export type SubscriptionCachePayload = {
  plan: string
  status: string
  hasAccess: boolean
  isTrialing: boolean
  isPaid: boolean
  trialStartedAt: string
  trialEndsAt: string
  subscriptionPeriodEndsAt: string | null
  daysRemainingInTrial: number | null
  requiresPayment: boolean
} & ConversationUsageSummary

function buildSubscriptionCacheKey(organizationId: string): string {
  return buildCacheKey(CACHE_NAMESPACES.subscription, 'org', organizationId)
}

function getSubscriptionCacheTtlSeconds(): number {
  return loadEnv().CACHE_SUBSCRIPTION_TTL_SECONDS
}

export async function getCachedSubscription(
  organizationId: string,
): Promise<SubscriptionCachePayload | null> {
  return getCachedJson<SubscriptionCachePayload>(buildSubscriptionCacheKey(organizationId))
}

export async function setCachedSubscription(
  organizationId: string,
  subscription: SubscriptionCachePayload,
): Promise<void> {
  await setCachedJson(
    buildSubscriptionCacheKey(organizationId),
    subscription,
    getSubscriptionCacheTtlSeconds(),
  )
}

export async function invalidateSubscriptionCache(organizationId: string): Promise<void> {
  await deleteCached(buildSubscriptionCacheKey(organizationId))
}
