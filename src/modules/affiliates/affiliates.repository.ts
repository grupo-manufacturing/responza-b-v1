import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'

export type AffiliateRecord = {
  id: string
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type ReferredOrganizationRecord = {
  id: string
  email: string
  name: string
  plan: string
  subscription_status: string
  trial_started_at: string
  trial_ends_at: string
  subscription_period_starts_at: string | null
  subscription_period_ends_at: string | null
  conversation_limit: number | null
  referred_at: string | null
  created_at: string
}

export type OrganizationReferralState = {
  id: string
  referred_by_affiliate_id: string | null
  referred_at: string | null
}

const AFFILIATE_COLUMNS = 'id, name, code, is_active, created_at, updated_at'

const REFERRED_ORG_COLUMNS =
  'id, email, name, plan, subscription_status, trial_started_at, trial_ends_at, subscription_period_starts_at, subscription_period_ends_at, conversation_limit, referred_at, created_at'

export async function listAffiliates(): Promise<AffiliateRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('affiliates')
    .select(AFFILIATE_COLUMNS)
    .order('created_at', { ascending: false })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list affiliates')
  }

  return (data ?? []) as AffiliateRecord[]
}

export async function findAffiliateById(id: string): Promise<AffiliateRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client.from('affiliates').select(AFFILIATE_COLUMNS).eq('id', id).maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load affiliate')
  }

  return data as AffiliateRecord | null
}

export async function findActiveAffiliateByCode(code: string): Promise<AffiliateRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('affiliates')
    .select(AFFILIATE_COLUMNS)
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to look up referral code')
  }

  return data as AffiliateRecord | null
}

export async function createAffiliate(input: {
  name: string
  code: string
}): Promise<AffiliateRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('affiliates')
    .insert({
      name: input.name,
      code: input.code,
      is_active: true,
    })
    .select(AFFILIATE_COLUMNS)
    .single()

  if (error !== null) {
    if (error.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'An affiliate with this code already exists')
    }
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create affiliate')
  }

  return data as AffiliateRecord
}

export async function updateAffiliate(
  id: string,
  patch: {
    name?: string
    is_active?: boolean
  },
): Promise<AffiliateRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('affiliates')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(AFFILIATE_COLUMNS)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update affiliate')
  }

  if (data === null) {
    throw new AppError(404, 'NOT_FOUND', 'Affiliate not found')
  }

  return data as AffiliateRecord
}

export async function listReferredOrganizations(
  affiliateId: string,
): Promise<ReferredOrganizationRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select(REFERRED_ORG_COLUMNS)
    .eq('referred_by_affiliate_id', affiliateId)
    .order('referred_at', { ascending: false })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list referred organizations')
  }

  return (data ?? []) as ReferredOrganizationRecord[]
}

export async function countReferralsByAffiliateIds(
  affiliateIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  for (const id of affiliateIds) {
    counts.set(id, 0)
  }

  if (affiliateIds.length === 0) {
    return counts
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select('referred_by_affiliate_id')
    .in('referred_by_affiliate_id', affiliateIds)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count referrals')
  }

  for (const row of data ?? []) {
    const affiliateId = row.referred_by_affiliate_id as string | null
    if (affiliateId === null) continue
    counts.set(affiliateId, (counts.get(affiliateId) ?? 0) + 1)
  }

  return counts
}

export async function getOrganizationReferralState(
  organizationId: string,
): Promise<OrganizationReferralState | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select('id, referred_by_affiliate_id, referred_at')
    .eq('id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load organization referral state')
  }

  return data as OrganizationReferralState | null
}

export async function attachReferralToOrganization(
  organizationId: string,
  affiliateId: string,
): Promise<void> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .update({
      referred_by_affiliate_id: affiliateId,
      referred_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .is('referred_by_affiliate_id', null)
    .select('id')
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to attach referral code')
  }

  void data
}
