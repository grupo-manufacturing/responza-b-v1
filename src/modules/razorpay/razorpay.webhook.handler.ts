import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import type { OrganizationRecord } from '../subscription/subscription.repository.js'
import * as subscriptionRepository from '../subscription/subscription.repository.js'
import {
  getBillingPlanCatalogEntry,
  isBillingPlanKey,
  resolveBillingPlanKeyByRazorpayPlanId,
  type BillingPlanKey,
} from './billing.plans.js'
import { recordWebhookEventIfNew } from './razorpay-webhook.repository.js'
import { verifyRazorpayWebhookSignature } from './razorpay.webhookSignature.js'
import type { RazorpaySubscription } from './razorpay.types.js'

type RazorpayWebhookPayload = {
  readonly entity?: string
  readonly event?: string
  readonly payload?: {
    readonly subscription?: {
      readonly entity?: RazorpaySubscription
    }
  }
}

function unixToIso(unix: number | null | undefined): string | null {
  if (unix === null || unix === undefined) {
    return null
  }

  return new Date(unix * 1000).toISOString()
}

function readNoteValue(notes: Record<string, string> | null | undefined, key: string): string | null {
  const value = notes?.[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  return value.trim()
}

function resolvePlanKey(subscription: RazorpaySubscription): BillingPlanKey | null {
  const env = loadEnv()
  const fromNotes = readNoteValue(subscription.notes, 'plan_key')
  if (fromNotes !== null && isBillingPlanKey(fromNotes)) {
    return fromNotes
  }

  return resolveBillingPlanKeyByRazorpayPlanId(env, subscription.plan_id)
}

function resolveBillingPeriod(subscription: RazorpaySubscription): {
  startsAt: string | null
  endsAt: string | null
} {
  return {
    startsAt: unixToIso(subscription.current_start) ?? unixToIso(subscription.start_at),
    endsAt: unixToIso(subscription.current_end) ?? unixToIso(subscription.end_at),
  }
}

async function resolveOrganization(
  subscription: RazorpaySubscription,
): Promise<OrganizationRecord | null> {
  const organizationId = readNoteValue(subscription.notes, 'organization_id')
  if (organizationId !== null) {
    const byId = await subscriptionRepository.findOrganizationById(organizationId)
    if (byId !== null) {
      return byId
    }
  }

  const bySubscription = await subscriptionRepository.findOrganizationByRazorpaySubscriptionId(
    subscription.id,
  )
  if (bySubscription !== null) {
    return bySubscription
  }

  if (subscription.customer_id !== null) {
    return subscriptionRepository.findOrganizationByRazorpayCustomerId(subscription.customer_id)
  }

  return null
}

async function syncRazorpayIdentifiers(
  organization: OrganizationRecord,
  subscription: RazorpaySubscription,
): Promise<void> {
  const updates: subscriptionRepository.ApplySubscriptionBillingStateInput = {
    organizationId: organization.id,
    subscriptionStatus: organization.subscription_status,
  }

  if (subscription.customer_id !== null && organization.razorpay_customer_id !== subscription.customer_id) {
    updates.razorpayCustomerId = subscription.customer_id
  }

  if (organization.razorpay_subscription_id !== subscription.id) {
    updates.razorpaySubscriptionId = subscription.id
  }

  if (
    updates.razorpayCustomerId !== undefined ||
    updates.razorpaySubscriptionId !== undefined
  ) {
    await subscriptionRepository.applySubscriptionBillingState(updates)
  }
}

async function handleSubscriptionAuthenticated(
  organization: OrganizationRecord,
  subscription: RazorpaySubscription,
): Promise<void> {
  await syncRazorpayIdentifiers(organization, subscription)

  const planKey = resolvePlanKey(subscription)
  const { startsAt, endsAt } = resolveBillingPeriod(subscription)

  await subscriptionRepository.applySubscriptionBillingState({
    organizationId: organization.id,
    subscriptionStatus: organization.subscription_status,
    plan: planKey ?? organization.plan,
    conversationLimit: planKey ? getBillingPlanCatalogEntry(planKey).conversationLimit : undefined,
    razorpayCustomerId: subscription.customer_id,
    razorpaySubscriptionId: subscription.id,
    subscriptionPeriodStartsAt: startsAt,
    subscriptionPeriodEndsAt: endsAt,
  })
}

async function handleSubscriptionActivated(
  organization: OrganizationRecord,
  subscription: RazorpaySubscription,
): Promise<void> {
  const planKey = resolvePlanKey(subscription)
  if (planKey === null) {
    logger.warn('[razorpay-webhook] subscription.activated without resolvable plan', {
      organizationId: organization.id,
      subscriptionId: subscription.id,
      planId: subscription.plan_id,
    })
    return
  }

  const plan = getBillingPlanCatalogEntry(planKey)
  const { startsAt, endsAt } = resolveBillingPeriod(subscription)

  await subscriptionRepository.applySubscriptionBillingState({
    organizationId: organization.id,
    subscriptionStatus: 'active',
    plan: plan.key,
    conversationLimit: plan.conversationLimit,
    subscriptionPeriodStartsAt: startsAt,
    subscriptionPeriodEndsAt: endsAt,
    razorpayCustomerId: subscription.customer_id,
    razorpaySubscriptionId: subscription.id,
  })
}

async function handleSubscriptionCharged(
  organization: OrganizationRecord,
  subscription: RazorpaySubscription,
): Promise<void> {
  const planKey = resolvePlanKey(subscription)
  const { startsAt, endsAt } = resolveBillingPeriod(subscription)

  await subscriptionRepository.applySubscriptionBillingState({
    organizationId: organization.id,
    subscriptionStatus: 'active',
    plan: planKey ?? organization.plan,
    conversationLimit: planKey ? getBillingPlanCatalogEntry(planKey).conversationLimit : undefined,
    subscriptionPeriodStartsAt: startsAt,
    subscriptionPeriodEndsAt: endsAt,
    razorpayCustomerId: subscription.customer_id,
    razorpaySubscriptionId: subscription.id,
  })
}

async function handleSubscriptionCancelled(
  organization: OrganizationRecord,
  subscription: RazorpaySubscription,
): Promise<void> {
  const { endsAt } = resolveBillingPeriod(subscription)
  const periodEnd = endsAt !== null ? new Date(endsAt) : null
  const keepAccessUntilPeriodEnd = periodEnd !== null && periodEnd > new Date()

  await subscriptionRepository.applySubscriptionBillingState({
    organizationId: organization.id,
    subscriptionStatus: keepAccessUntilPeriodEnd ? 'active' : 'expired',
    subscriptionPeriodEndsAt: endsAt,
    razorpayCustomerId: subscription.customer_id,
    razorpaySubscriptionId: subscription.id,
  })
}

async function handleSubscriptionEnded(
  organization: OrganizationRecord,
  subscription: RazorpaySubscription,
): Promise<void> {
  await subscriptionRepository.applySubscriptionBillingState({
    organizationId: organization.id,
    subscriptionStatus: 'expired',
    razorpayCustomerId: subscription.customer_id,
    razorpaySubscriptionId: subscription.id,
  })
}

async function dispatchSubscriptionEvent(
  eventType: string,
  subscription: RazorpaySubscription,
): Promise<void> {
  const organization = await resolveOrganization(subscription)
  if (organization === null) {
    logger.warn('[razorpay-webhook] organization not found for subscription event', {
      eventType,
      subscriptionId: subscription.id,
    })
    return
  }

  switch (eventType) {
    case 'subscription.authenticated':
      await handleSubscriptionAuthenticated(organization, subscription)
      return
    case 'subscription.activated':
      await handleSubscriptionActivated(organization, subscription)
      return
    case 'subscription.charged':
      await handleSubscriptionCharged(organization, subscription)
      return
    case 'subscription.cancelled':
      await handleSubscriptionCancelled(organization, subscription)
      return
    case 'subscription.halted':
    case 'subscription.completed':
    case 'subscription.expired':
      await handleSubscriptionEnded(organization, subscription)
      return
    default:
      logger.warn(`[razorpay-webhook] ignored subscription event ${eventType}`)
  }
}

export async function processRazorpayWebhook(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
  eventIdHeader: string | undefined
  body: unknown
}): Promise<void> {
  const { RAZORPAY_WEBHOOK_SECRET } = loadEnv()

  if (RAZORPAY_WEBHOOK_SECRET.trim().length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'RAZORPAY_WEBHOOK_SECRET is not configured')
  }

  if (
    !verifyRazorpayWebhookSignature(
      input.rawBody,
      input.signatureHeader,
      RAZORPAY_WEBHOOK_SECRET,
    )
  ) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid Razorpay webhook signature')
  }

  const payload = input.body as RazorpayWebhookPayload
  const eventType = payload.event
  if (typeof eventType !== 'string' || eventType.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Razorpay webhook event type is missing')
  }

  const eventId = input.eventIdHeader?.trim()
  if (eventId === undefined || eventId.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Razorpay webhook event id is missing')
  }

  const isNewEvent = await recordWebhookEventIfNew({
    eventId,
    eventType,
    payload: input.body,
  })

  if (!isNewEvent) {
    logger.warn(`[razorpay-webhook] duplicate event ignored ${eventId} ${eventType}`)
    return
  }

  const subscription = payload.payload?.subscription?.entity
  if (subscription === undefined) {
    logger.warn(`[razorpay-webhook] event without subscription payload ignored ${eventType}`)
    return
  }

  await dispatchSubscriptionEvent(eventType, subscription)
}
