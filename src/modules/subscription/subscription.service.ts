import { loadEnv } from '../../shared/config/index.js'
import { resolveEffectiveSubscriptionStatus, toSubscriptionResponse } from '../../shared/subscription/index.js'
import { AppError } from '../../shared/errors/index.js'
import * as subscriptionRepository from './subscription.repository.js'

function addDays(from: Date, days: number): Date {
  const result = new Date(from)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

export async function getSubscriptionForOrganization(organizationId: string) {
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
  }

  const refreshed =
    effectiveStatus === 'expired' && organization.subscription_status !== 'expired'
      ? await subscriptionRepository.findOrganizationById(organizationId)
      : organization

  if (refreshed === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load subscription')
  }

  return toSubscriptionResponse(refreshed, refreshed.plan, now)
}

export async function activateSubscription(organizationId: string) {
  const env = loadEnv()
  const organization = await subscriptionRepository.findOrganizationById(organizationId)
  if (organization === null) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found')
  }

  const periodEndsAt = addDays(new Date(), env.SUBSCRIPTION_PERIOD_DAYS).toISOString()
  const updated = await subscriptionRepository.activatePaidSubscription(organizationId, periodEndsAt)

  return toSubscriptionResponse(updated, updated.plan)
}
