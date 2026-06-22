import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'

export async function insertConversationUsageIfNew(input: {
  organizationId: string
  conversationId: string
  billingPeriodStart: string
  billingPeriodEnd: string | null
}): Promise<boolean> {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('billing_conversation_usage').insert({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    billing_period_start: input.billingPeriodStart,
    billing_period_end: input.billingPeriodEnd,
  })

  if (error === null) {
    return true
  }

  if (error.code === '23505') {
    return false
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Failed to record conversation usage')
}

export async function countConversationUsageForPeriod(input: {
  organizationId: string
  billingPeriodStart: string
}): Promise<number> {
  const client = getSupabaseAdminClient()
  const { count, error } = await client
    .from('billing_conversation_usage')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', input.organizationId)
    .eq('billing_period_start', input.billingPeriodStart)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count conversation usage')
  }

  return count ?? 0
}
