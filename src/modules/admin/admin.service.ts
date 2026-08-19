import { resolveEffectiveSubscriptionStatus } from '../../shared/subscription/index.js'
import type { OrganizationSubscriptionRecord } from '../../shared/subscription/index.js'
import {
  areAdminCredentialsConfigured,
  issueAdminToken,
  verifyAdminCredentials,
} from '../../shared/admin/session.js'
import { AppError } from '../../shared/errors/index.js'
import { buildAdminPagination } from './admin.pagination.js'
import type { AdminPaginationQuery } from './admin.schemas.js'
import * as adminRepository from './admin.repository.js'

export function loginAdmin(input: { username: string; password: string }) {
  if (!areAdminCredentialsConfigured()) {
    throw new AppError(503, 'INTERNAL_ERROR', 'Admin login is not configured')
  }

  if (!verifyAdminCredentials(input.username, input.password)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid admin credentials')
  }

  return {
    accessToken: issueAdminToken(input.username.trim()),
    username: input.username.trim(),
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function daysAgoUtc(days: number, now: Date): Date {
  const start = startOfUtcDay(now)
  start.setUTCDate(start.getUTCDate() - days)
  return start
}

function toSubscriptionRecord(
  org: adminRepository.AdminOrganizationSubscriptionSnapshot | adminRepository.AdminOrganizationRecord,
): OrganizationSubscriptionRecord {
  return {
    subscription_status: org.subscription_status as OrganizationSubscriptionRecord['subscription_status'],
    trial_started_at: org.trial_started_at,
    trial_ends_at: org.trial_ends_at,
    subscription_period_starts_at: org.subscription_period_starts_at,
    subscription_period_ends_at: org.subscription_period_ends_at,
    razorpay_customer_id: org.razorpay_customer_id,
    razorpay_subscription_id: org.razorpay_subscription_id,
    conversation_limit: org.conversation_limit,
  }
}

function buildOverviewCounts(
  snapshots: adminRepository.AdminOrganizationSubscriptionSnapshot[],
  now: Date,
) {
  let trialCount = 0
  let activeCount = 0
  let expiredCount = 0

  for (const org of snapshots) {
    const effectiveStatus = resolveEffectiveSubscriptionStatus(toSubscriptionRecord(org), now)
    if (effectiveStatus === 'trialing') trialCount += 1
    else if (effectiveStatus === 'active') activeCount += 1
    else expiredCount += 1
  }

  return {
    organizationCount: snapshots.length,
    trialCount,
    activeCount,
    expiredCount,
  }
}

export async function getAdminDashboard(query: AdminPaginationQuery) {
  const now = new Date()
  const [subscriptionSnapshots, organizationPage, conversationsToday, conversationsThisWeek] =
    await Promise.all([
      adminRepository.listOrganizationSubscriptionSnapshotsForAdmin(),
      adminRepository.listOrganizationsForAdmin({
        page: query.page,
        limit: query.limit,
      }),
      adminRepository.countConversationsCreatedSince(startOfUtcDay(now).toISOString()),
      adminRepository.countConversationsCreatedSince(daysAgoUtc(7, now).toISOString()),
    ])

  const integrations = await adminRepository.listConnectedIntegrationsForOrganizations(
    organizationPage.organizations.map((org) => org.id),
  )

  const connectedByOrg = new Map<string, { whatsapp: boolean; instagram: boolean }>()
  for (const row of integrations) {
    const current = connectedByOrg.get(row.organization_id) ?? { whatsapp: false, instagram: false }
    if (row.platform === 'whatsapp') {
      current.whatsapp = true
    }
    if (row.platform === 'instagram') {
      current.instagram = true
    }
    connectedByOrg.set(row.organization_id, current)
  }

  const organizationRows = organizationPage.organizations.map((org) => {
    const effectiveStatus = resolveEffectiveSubscriptionStatus(toSubscriptionRecord(org), now)
    const connected = connectedByOrg.get(org.id) ?? { whatsapp: false, instagram: false }

    return {
      id: org.id,
      email: org.email,
      name: org.name,
      plan: org.plan,
      status: effectiveStatus,
      trialEndsAt: org.trial_ends_at,
      subscriptionPeriodEndsAt: org.subscription_period_ends_at,
      razorpaySubscriptionId: org.razorpay_subscription_id,
      conversationLimit: org.conversation_limit,
      emailVerified: org.email_verified,
      createdAt: org.created_at,
      whatsappConnected: connected.whatsapp,
      instagramConnected: connected.instagram,
    }
  })

  return {
    overview: {
      ...buildOverviewCounts(subscriptionSnapshots, now),
      conversationsToday,
      conversationsThisWeek,
    },
    organizations: organizationRows,
    pagination: buildAdminPagination(query.page, query.limit, organizationPage.total),
  }
}
