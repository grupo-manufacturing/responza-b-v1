import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { LeadStatus } from '../leads/leads.constants.js'
import type { LeadRecord } from '../leads/leads.repository.js'
import type { MessageDirection } from '../inbox/inbox.schemas.js'

const LEAD_COLUMNS =
  'id, organization_id, name, email, phone, notes, status, created_at, updated_at'

export type MessageDirectionSnapshot = {
  conversation_id: string
  direction: MessageDirection
  content: string
  created_at: string
}

export type ResponseTimeMessageRow = {
  conversation_id: string
  direction: MessageDirection
  created_at: string
}

export async function listFollowUpLeads(input: {
  organizationId: string
  statuses: readonly LeadStatus[]
  limit: number
}): Promise<LeadRecord[]> {
  const client = getSupabaseAdminClient()

  const { data, error } = await client
    .from('leads')
    .select(LEAD_COLUMNS)
    .eq('organization_id', input.organizationId)
    .in('status', [...input.statuses])
    .order('updated_at', { ascending: true })
    .limit(input.limit)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load dashboard leads')
  }

  return (data ?? []).map(normalizeLeadRecord)
}

export async function fetchLatestMessageSnapshots(
  organizationId: string,
  conversationIds: string[],
): Promise<Map<string, MessageDirectionSnapshot>> {
  if (conversationIds.length === 0) {
    return new Map()
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select('conversation_id, direction, content, created_at')
    .eq('organization_id', organizationId)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load conversation messages')
  }

  const latestByConversation = new Map<string, MessageDirectionSnapshot>()

  for (const row of data ?? []) {
    const conversationId = row.conversation_id as string
    if (latestByConversation.has(conversationId)) {
      continue
    }

    latestByConversation.set(conversationId, {
      conversation_id: conversationId,
      direction: row.direction as MessageDirection,
      content: row.content as string,
      created_at: row.created_at as string,
    })
  }

  return latestByConversation
}

export async function fetchMessagesForResponseTime(
  organizationId: string,
  sinceIso: string,
): Promise<ResponseTimeMessageRow[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select('conversation_id, direction, created_at')
    .eq('organization_id', organizationId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load messages for response time')
  }

  return (data ?? []).map((row) => ({
    conversation_id: row.conversation_id as string,
    direction: row.direction as MessageDirection,
    created_at: row.created_at as string,
  }))
}

function normalizeLeadRecord(row: Record<string, unknown>): LeadRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: row.status as LeadStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}
