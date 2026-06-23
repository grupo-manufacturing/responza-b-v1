import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { MessageDirection, MessageStatus, MessageContentType } from '../inbox.schemas.js'
import type { MessageRecord } from './types.js'

const MESSAGE_COLUMNS =
  'id, organization_id, conversation_id, participant_id, direction, platform_message_id, content, content_type, storage_path, mime_type, platform_media_id, file_size_bytes, status, customer_reaction, agent_reaction, created_at'

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

export async function listRecentMessagesForConversation(input: {
  organization_id: string
  conversation_id: string
  limit: number
}): Promise<MessageRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('conversation_id', input.conversation_id)
    .order('created_at', { ascending: false })
    .limit(input.limit)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load recent messages')
  }

  return (data ?? []).map(normalizeMessageRecord).reverse()
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

export async function markOutboundMessageReadByPlatformId(input: {
  organization_id: string
  platform_message_id: string
}): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data: existing, error: findError } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('platform_message_id', input.platform_message_id)
    .eq('direction', 'outbound')
    .maybeSingle()

  if (findError !== null || existing === null) {
    return null
  }

  const currentStatus = existing.status as MessageStatus
  if (currentStatus === 'read') {
    return normalizeMessageRecord(existing)
  }

  if (currentStatus !== 'sent') {
    return null
  }

  const { data, error } = await client
    .from('messages')
    .update({ status: 'read' })
    .eq('organization_id', input.organization_id)
    .eq('id', existing.id as string)
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    return null
  }

  return normalizeMessageRecord(data)
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
  content_type?: MessageContentType
  storage_path?: string | null
  mime_type?: string | null
  platform_media_id?: string | null
  file_size_bytes?: number | null
}

const PENDING_ECHO_MATCH_WINDOW_MS = 60_000

export type InsertOutboundEchoMessageInput = {
  organization_id: string
  conversation_id: string
  platform_message_id: string
  content: string
}

export async function findMessageByPlatformMessageId(input: {
  organization_id: string
  conversation_id: string
  platform_message_id: string
}): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('conversation_id', input.conversation_id)
    .eq('platform_message_id', input.platform_message_id)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return normalizeMessageRecord(data)
}

export async function findRecentPendingOutbound(input: {
  organization_id: string
  conversation_id: string
  content: string
  withinMs: number
}): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const since = new Date(Date.now() - input.withinMs).toISOString()

  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('conversation_id', input.conversation_id)
    .eq('direction', 'outbound')
    .eq('status', 'pending')
    .is('platform_message_id', null)
    .eq('content', input.content)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return normalizeMessageRecord(data)
}

export async function insertOutboundEchoMessage(
  input: InsertOutboundEchoMessageInput,
): Promise<MessageRecord | null> {
  const existing = await findMessageByPlatformMessageId({
    organization_id: input.organization_id,
    conversation_id: input.conversation_id,
    platform_message_id: input.platform_message_id,
  })

  if (existing !== null) {
    return null
  }

  const pending = await findRecentPendingOutbound({
    organization_id: input.organization_id,
    conversation_id: input.conversation_id,
    content: input.content,
    withinMs: PENDING_ECHO_MATCH_WINDOW_MS,
  })

  if (pending !== null) {
    return updateMessageDeliveryStatus({
      organization_id: input.organization_id,
      message_id: pending.id,
      status: 'sent',
      platform_message_id: input.platform_message_id,
    })
  }

  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('messages')
    .insert({
      organization_id: input.organization_id,
      conversation_id: input.conversation_id,
      participant_id: null,
      direction: 'outbound',
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

    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to receive outbound echo')
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
      content_type: input.content_type ?? 'text',
      storage_path: input.storage_path ?? null,
      mime_type: input.mime_type ?? null,
      platform_media_id: input.platform_media_id ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
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

export async function findMessageById(input: {
  organization_id: string
  conversation_id: string
  message_id: string
}): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('conversation_id', input.conversation_id)
    .eq('id', input.message_id)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return normalizeMessageRecord(data)
}

export async function findMessageByIdForOrganization(input: {
  organization_id: string
  message_id: string
}): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('id', input.message_id)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load message')
  }

  if (data === null) {
    return null
  }

  return normalizeMessageRecord(data)
}

export async function updateCustomerReactionByPlatformMessageId(input: {
  organization_id: string
  platform_message_id: string
  emoji: string | null
}): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data: existing, error: findError } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('platform_message_id', input.platform_message_id)
    .maybeSingle()

  if (findError !== null || existing === null) {
    return null
  }

  const { data, error } = await client
    .from('messages')
    .update({ customer_reaction: input.emoji })
    .eq('organization_id', input.organization_id)
    .eq('id', existing.id as string)
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    return null
  }

  return normalizeMessageRecord(data)
}

export async function updateAgentReaction(input: {
  organization_id: string
  message_id: string
  emoji: string | null
}): Promise<MessageRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .update({ agent_reaction: input.emoji })
    .eq('organization_id', input.organization_id)
    .eq('id', input.message_id)
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update message reaction')
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
    content_type: (row.content_type as MessageContentType | undefined) ?? 'text',
    storage_path: (row.storage_path as string | null) ?? null,
    mime_type: (row.mime_type as string | null) ?? null,
    platform_media_id: (row.platform_media_id as string | null) ?? null,
    file_size_bytes:
      typeof row.file_size_bytes === 'number' ? row.file_size_bytes : null,
    status: row.status as MessageStatus,
    customer_reaction: (row.customer_reaction as string | null) ?? null,
    agent_reaction: (row.agent_reaction as string | null) ?? null,
    created_at: row.created_at as string,
  }
}
