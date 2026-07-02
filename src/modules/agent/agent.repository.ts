import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'

export type AgentInboundMessageRecord = {
  id: string
  organization_id: string
  conversation_id: string
  content: string
  content_type: string
  created_at: string
  direction: 'inbound' | 'outbound'
}

const INBOUND_MESSAGE_COLUMNS =
  'id, organization_id, conversation_id, content, content_type, created_at, direction'

export async function isAgentEnabledForOrganization(organizationId: string): Promise<boolean> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organizations')
    .select('agent_enabled')
    .eq('id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load agent settings')
  }

  if (data === null) {
    return false
  }

  return data.agent_enabled === true
}

export async function getAgentReplyCountForDate(
  organizationId: string,
  usageDate: string,
): Promise<number> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('agent_reply_usage')
    .select('reply_count')
    .eq('organization_id', organizationId)
    .eq('usage_date', usageDate)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load agent reply usage')
  }

  if (data === null) {
    return 0
  }

  return data.reply_count
}

export async function setAgentReplyCount(
  organizationId: string,
  usageDate: string,
  replyCount: number,
): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('agent_reply_usage').upsert(
    {
      organization_id: organizationId,
      usage_date: usageDate,
      reply_count: replyCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'organization_id,usage_date' },
  )

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to record agent reply usage')
  }
}

export async function findInboundMessage(input: {
  organizationId: string
  conversationId: string
  messageId: string
}): Promise<AgentInboundMessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(INBOUND_MESSAGE_COLUMNS)
    .eq('organization_id', input.organizationId)
    .eq('conversation_id', input.conversationId)
    .eq('id', input.messageId)
    .eq('direction', 'inbound')
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load inbound message')
  }

  if (data === null) {
    return null
  }

  return data as AgentInboundMessageRecord
}

export async function findLatestInboundMessageId(
  organizationId: string,
  conversationId: string,
): Promise<string | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('conversation_id', conversationId)
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load latest inbound message')
  }

  if (data === null) {
    return null
  }

  return data.id as string
}

export async function hasHumanOutboundAfter(input: {
  organizationId: string
  conversationId: string
  afterCreatedAt: string
}): Promise<boolean> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('conversation_id', input.conversationId)
    .eq('direction', 'outbound')
    .eq('send_source', 'human')
    .gt('created_at', input.afterCreatedAt)
    .limit(1)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to check human outbound messages')
  }

  return data !== null
}

export async function hasAgentOutboundAfter(input: {
  organizationId: string
  conversationId: string
  afterCreatedAt: string
}): Promise<boolean> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select('id')
    .eq('organization_id', input.organizationId)
    .eq('conversation_id', input.conversationId)
    .eq('direction', 'outbound')
    .eq('send_source', 'agent')
    .gt('created_at', input.afterCreatedAt)
    .limit(1)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to check agent outbound messages')
  }

  return data !== null
}
