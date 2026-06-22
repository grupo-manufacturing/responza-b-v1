import { AppError } from '../../shared/errors/index.js'
import {
  resolveEffectiveSubscriptionStatus,
  type OrganizationSubscriptionRecord,
} from '../../shared/subscription/index.js'
import {
  getBillingPlanCatalogEntry,
  isBillingPlanKey,
} from '../razorpay/billing.plans.js'
import type { OrganizationRecord } from './subscription.repository.js'
import * as subscriptionRepository from './subscription.repository.js'
import * as usageRepository from './usage.repository.js'

export type ConversationUsageSummary = {
  conversationQuotaEnforced: boolean
  conversationLimit: number | null
  conversationsUsed: number | null
  conversationsRemaining: number | null
}

type BillingPeriod = {
  startsAt: string
  endsAt: string | null
}

function resolveBillingPeriod(organization: OrganizationSubscriptionRecord): BillingPeriod | null {
  const status = resolveEffectiveSubscriptionStatus(organization)
  if (status !== 'active') {
    return null
  }

  if (organization.subscription_period_starts_at === null) {
    return null
  }

  return {
    startsAt: organization.subscription_period_starts_at,
    endsAt: organization.subscription_period_ends_at,
  }
}

export function resolveConversationLimit(organization: OrganizationRecord): number | null {
  const status = resolveEffectiveSubscriptionStatus(organization)
  if (status !== 'active') {
    return null
  }

  if (organization.conversation_limit !== null) {
    return organization.conversation_limit
  }

  if (isBillingPlanKey(organization.plan)) {
    return getBillingPlanCatalogEntry(organization.plan).conversationLimit
  }

  return null
}

function isQuotaEnforced(organization: OrganizationRecord): boolean {
  return resolveConversationLimit(organization) !== null && resolveBillingPeriod(organization) !== null
}

export async function getConversationUsageSummary(
  organization: OrganizationRecord,
): Promise<ConversationUsageSummary> {
  const limit = resolveConversationLimit(organization)
  const billingPeriod = resolveBillingPeriod(organization)

  if (limit === null || billingPeriod === null) {
    return {
      conversationQuotaEnforced: false,
      conversationLimit: limit,
      conversationsUsed: null,
      conversationsRemaining: null,
    }
  }

  const used = await usageRepository.countConversationUsageForPeriod({
    organizationId: organization.id,
    billingPeriodStart: billingPeriod.startsAt,
  })

  return {
    conversationQuotaEnforced: true,
    conversationLimit: limit,
    conversationsUsed: used,
    conversationsRemaining: Math.max(0, limit - used),
  }
}

export async function assertCanCreateConversation(organizationId: string): Promise<void> {
  const organization = await subscriptionRepository.findOrganizationById(organizationId)
  if (organization === null) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found')
  }

  if (!isQuotaEnforced(organization)) {
    return
  }

  const summary = await getConversationUsageSummary(organization)
  if (
    summary.conversationLimit !== null &&
    summary.conversationsUsed !== null &&
    summary.conversationsUsed >= summary.conversationLimit
  ) {
    throw new AppError(
      402,
      'CONVERSATION_LIMIT_REACHED',
      'You have reached your monthly conversation limit. Upgrade your plan to start new conversations.',
      { usage: summary },
    )
  }
}

export async function recordBillableConversation(
  organizationId: string,
  conversationId: string,
): Promise<void> {
  const organization = await subscriptionRepository.findOrganizationById(organizationId)
  if (organization === null) {
    return
  }

  const billingPeriod = resolveBillingPeriod(organization)
  if (billingPeriod === null) {
    return
  }

  await usageRepository.insertConversationUsageIfNew({
    organizationId,
    conversationId,
    billingPeriodStart: billingPeriod.startsAt,
    billingPeriodEnd: billingPeriod.endsAt,
  })
}
