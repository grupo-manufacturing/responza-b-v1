import { resolveEffectiveSubscriptionStatus } from '../../shared/subscription/index.js'
import type { OrganizationSubscriptionRecord } from '../../shared/subscription/index.js'
import {
  areAdminCredentialsConfigured,
  issueAdminToken,
  verifyAdminCredentials,
} from '../../shared/admin/session.js'
import { AppError } from '../../shared/errors/index.js'
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
  org: adminRepository.AdminOrganizationRecord,
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

export async function getAdminDashboard() {
  const now = new Date()
  const [organizations, integrations, conversationsToday, conversationsThisWeek] = await Promise.all([
    adminRepository.listOrganizationsForAdmin(),
    adminRepository.listConnectedIntegrationsForAdmin(),
    adminRepository.countConversationsCreatedSince(startOfUtcDay(now).toISOString()),
    adminRepository.countConversationsCreatedSince(daysAgoUtc(7, now).toISOString()),
  ])

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

  let trialCount = 0
  let activeCount = 0
  let expiredCount = 0

  const organizationRows = organizations.map((org) => {
    const effectiveStatus = resolveEffectiveSubscriptionStatus(toSubscriptionRecord(org), now)
    if (effectiveStatus === 'trialing') trialCount += 1
    else if (effectiveStatus === 'active') activeCount += 1
    else expiredCount += 1

    const connected = connectedByOrg.get(org.id) ?? { whatsapp: false, instagram: false }

    return {
      id: org.id,
      email: org.email,
      name: org.name,
      plan: org.plan,
      status: effectiveStatus,
      storedStatus: org.subscription_status,
      trialEndsAt: org.trial_ends_at,
      subscriptionPeriodEndsAt: org.subscription_period_ends_at,
      razorpayCustomerId: org.razorpay_customer_id,
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
      organizationCount: organizations.length,
      trialCount,
      activeCount,
      expiredCount,
      conversationsToday,
      conversationsThisWeek,
    },
    organizations: organizationRows,
  }
}
