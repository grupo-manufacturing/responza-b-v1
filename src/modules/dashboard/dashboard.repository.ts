import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { MessageDirection } from '../inbox/inbox.schemas.js'

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
