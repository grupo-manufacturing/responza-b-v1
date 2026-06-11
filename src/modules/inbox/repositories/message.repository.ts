import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { MessageDirection, MessageStatus } from '../inbox.schemas.js'
import type { MessageRecord } from './types.js'

const MESSAGE_COLUMNS =
  'id, organization_id, conversation_id, participant_id, direction, platform_message_id, content, status, created_at'

export async function listMessagesByConversationId(
  organizationId: string,
  conversationId: string,
): Promise<MessageRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list messages')
  }

  return (data ?? []).map(normalizeMessageRecord)
}

export type InsertOutboundMessageInput = {
  organization_id: string
  conversation_id: string
  content: string
}

export async function insertOutboundMessage(
  input: InsertOutboundMessageInput,
): Promise<MessageRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('messages')
    .insert({
      organization_id: input.organization_id,
      conversation_id: input.conversation_id,
      participant_id: null,
      direction: 'outbound',
      platform_message_id: null,
      content: input.content,
      status: 'pending',
    })
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to send message')
  }

  const { error: conversationError } = await client
    .from('conversations')
    .update({ last_message_at: now })
    .eq('organization_id', input.organization_id)
    .eq('id', input.conversation_id)

  if (conversationError !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update conversation')
  }

  return normalizeMessageRecord(data)
}

export type UpdateMessageDeliveryStatusInput = {
  organization_id: string
  message_id: string
  status: MessageStatus
  platform_message_id?: string | null
}

export async function updateMessageDeliveryStatus(
  input: UpdateMessageDeliveryStatusInput,
): Promise<MessageRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .update({
      status: input.status,
      platform_message_id: input.platform_message_id ?? null,
    })
    .eq('organization_id', input.organization_id)
    .eq('id', input.message_id)
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update message status')
  }

  return normalizeMessageRecord(data)
}

export type InsertInboundMessageInput = {
  organization_id: string
  conversation_id: string
  participant_id: string
  platform_message_id: string
  content: string
}

export async function insertInboundMessage(
  input: InsertInboundMessageInput,
): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('messages')
    .insert({
      organization_id: input.organization_id,
      conversation_id: input.conversation_id,
      participant_id: input.participant_id,
      direction: 'inbound',
      platform_message_id: input.platform_message_id,
      content: input.content,
      status: 'sent',
    })
    .select(MESSAGE_COLUMNS)
    .maybeSingle()

  if (error !== null) {
    if (error.code === '23505') {
      return null
    }

    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to receive message')
  }

  if (data === null) {
    return null
  }

  const { error: conversationError } = await client
    .from('conversations')
    .update({ last_message_at: now })
    .eq('organization_id', input.organization_id)
    .eq('id', input.conversation_id)

  if (conversationError !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update conversation')
  }

  return normalizeMessageRecord(data)
}

function normalizeMessageRecord(row: Record<string, unknown>): MessageRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    conversation_id: row.conversation_id as string,
    participant_id: (row.participant_id as string | null) ?? null,
    direction: row.direction as MessageDirection,
    platform_message_id: (row.platform_message_id as string | null) ?? null,
    content: row.content as string,
    status: row.status as MessageStatus,
    created_at: row.created_at as string,
  }
}
