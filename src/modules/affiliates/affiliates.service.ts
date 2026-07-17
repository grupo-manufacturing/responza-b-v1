import { resolveEffectiveSubscriptionStatus } from '../../shared/subscription/index.js'
import type { OrganizationSubscriptionRecord } from '../../shared/subscription/index.js'
import { AppError } from '../../shared/errors/index.js'
import * as affiliatesRepository from './affiliates.repository.js'
import type { CreateAffiliateBody, UpdateAffiliateBody } from './affiliates.schemas.js'
import { normalizeAffiliateCode } from './affiliates.schemas.js'

function toAffiliateResponse(
  affiliate: affiliatesRepository.AffiliateRecord,
  referralCount: number,
  activePaidReferralCount: number,
) {
  return {
    id: affiliate.id,
    name: affiliate.name,
    code: affiliate.code,
    notes: affiliate.notes,
    isActive: affiliate.is_active,
    referralCount,
    activePaidReferralCount,
    createdAt: affiliate.created_at,
    updatedAt: affiliate.updated_at,
  }
}

function toSubscriptionRecord(
  org: affiliatesRepository.ReferredOrganizationRecord,
): OrganizationSubscriptionRecord {
  return {
    subscription_status: org.subscription_status as OrganizationSubscriptionRecord['subscription_status'],
    trial_started_at: org.trial_started_at,
    trial_ends_at: org.trial_ends_at,
    subscription_period_starts_at: org.subscription_period_starts_at,
    subscription_period_ends_at: org.subscription_period_ends_at,
    razorpay_customer_id: null,
    razorpay_subscription_id: null,
    conversation_limit: org.conversation_limit,
  }
}

export async function listAffiliates() {
  const affiliates = await affiliatesRepository.listAffiliates()
  const counts = await affiliatesRepository.countReferralsByAffiliateIds(affiliates.map((row) => row.id))

  const now = new Date()
  const responses = await Promise.all(
    affiliates.map(async (affiliate) => {
      const referralCount = counts.get(affiliate.id) ?? 0
      let activePaidReferralCount = 0

      if (referralCount > 0) {
        const referred = await affiliatesRepository.listReferredOrganizations(affiliate.id)
        activePaidReferralCount = referred.filter(
          (org) => resolveEffectiveSubscriptionStatus(toSubscriptionRecord(org), now) === 'active',
        ).length
      }

      return toAffiliateResponse(affiliate, referralCount, activePaidReferralCount)
    }),
  )

  return { affiliates: responses }
}

export async function createAffiliate(input: CreateAffiliateBody) {
  const affiliate = await affiliatesRepository.createAffiliate({
    name: input.name,
    code: input.code,
    notes: input.notes ?? null,
  })

  return {
    affiliate: toAffiliateResponse(affiliate, 0, 0),
  }
}

export async function updateAffiliate(id: string, input: UpdateAffiliateBody) {
  const existing = await affiliatesRepository.findAffiliateById(id)
  if (existing === null) {
    throw new AppError(404, 'NOT_FOUND', 'Affiliate not found')
  }

  const patch: {
    name?: string
    notes?: string | null
    is_active?: boolean
  } = {}

  if (input.name !== undefined) patch.name = input.name
  if (input.notes !== undefined) patch.notes = input.notes
  if (input.isActive !== undefined) patch.is_active = input.isActive

  const updated = await affiliatesRepository.updateAffiliate(id, patch)
  const referred = await affiliatesRepository.listReferredOrganizations(id)
  const now = new Date()
  const activePaidReferralCount = referred.filter(
    (org) => resolveEffectiveSubscriptionStatus(toSubscriptionRecord(org), now) === 'active',
  ).length

  return {
    affiliate: toAffiliateResponse(updated, referred.length, activePaidReferralCount),
  }
}

export async function getAffiliateReferrals(id: string) {
  const affiliate = await affiliatesRepository.findAffiliateById(id)
  if (affiliate === null) {
    throw new AppError(404, 'NOT_FOUND', 'Affiliate not found')
  }

  const referred = await affiliatesRepository.listReferredOrganizations(id)
  const now = new Date()

  const referrals = referred.map((org) => {
    const status = resolveEffectiveSubscriptionStatus(toSubscriptionRecord(org), now)
    return {
      id: org.id,
      email: org.email,
      name: org.name,
      plan: org.plan,
      status,
      conversationLimit: org.conversation_limit,
      referredAt: org.referred_at,
      createdAt: org.created_at,
    }
  })

  const activePaidReferralCount = referrals.filter((row) => row.status === 'active').length

  return {
    affiliate: toAffiliateResponse(affiliate, referrals.length, activePaidReferralCount),
    referrals,
  }
}

/**
 * Apply optional referral code once. Invalid codes throw; already-attributed orgs are a no-op.
 * Pass dryRun to validate without writing.
 */
export async function applyReferralCodeIfPresent(
  organizationId: string,
  referralCode: string | null | undefined,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  if (referralCode === undefined || referralCode === null) {
    return
  }

  const normalized = normalizeAffiliateCode(referralCode)
  if (normalized.length === 0) {
    return
  }

  const org = await affiliatesRepository.getOrganizationReferralState(organizationId)
  if (org === null) {
    throw new AppError(404, 'NOT_FOUND', 'Organization not found')
  }

  if (org.referred_by_affiliate_id !== null) {
    return
  }

  const affiliate = await affiliatesRepository.findActiveAffiliateByCode(normalized)
  if (affiliate === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid or inactive referral code', {
      fieldErrors: { referralCode: 'Invalid or inactive referral code' },
    })
  }

  if (options.dryRun === true) {
    return
  }

  await affiliatesRepository.attachReferralToOrganization(organizationId, affiliate.id)
}
