import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { MessageDirection, MessageStatus, MessageContentType } from '../inbox.schemas.js'
import {
  decodeMessageListCursor,
  encodeMessageListCursor,
  MAX_MESSAGE_PAGE_SIZE,
  messageListBeforeCursorFilter,
} from '../message.pagination.js'
import { touchConversationOnNewMessage } from './conversation.repository.js'
import type { ListMessagesInput, ListMessagesResult, MessageRecord } from './types.js'

const MESSAGE_COLUMNS =
  'id, organization_id, conversation_id, participant_id, direction, platform_message_id, content, content_type, storage_path, mime_type, platform_media_id, file_size_bytes, status, send_source, created_at'

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

export async function listMessagesForConversation(
  input: ListMessagesInput,
): Promise<ListMessagesResult> {
  const pageSize = Math.min(Math.max(1, input.limit), MAX_MESSAGE_PAGE_SIZE)

  if (input.before !== undefined) {
    const decoded = decodeMessageListCursor(input.before)
    if (decoded === null) {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid message cursor')
    }
  }

  const client = getSupabaseAdminClient()

  let query = client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('organization_id', input.organization_id)
    .eq('conversation_id', input.conversation_id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (input.before !== undefined) {
    const decoded = decodeMessageListCursor(input.before)
    if (decoded !== null) {
      query = query.or(messageListBeforeCursorFilter(decoded))
    }
  }

  const { data, error } = await query.limit(pageSize + 1)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list messages')
  }

  let messages = (data ?? []).map(normalizeMessageRecord)

  let hasMore = false
  let nextCursor: string | null = null

  if (messages.length > pageSize) {
    hasMore = true
    messages = messages.slice(0, pageSize)
  }

  messages.reverse()

  const oldestMessage = messages[0]
  if (hasMore && oldestMessage !== undefined) {
    nextCursor = encodeMessageListCursor({
      createdAt: oldestMessage.created_at,
      id: oldestMessage.id,
    })
  }

  return {
    messages,
    nextCursor,
    hasMore,
  }
}

export async function listRecentMessagesForConversation(input: {
  organization_id: string
  conversation_id: string
  limit: number
}): Promise<MessageRecord[]> {
  const result = await listMessagesForConversation({
    organization_id: input.organization_id,
    conversation_id: input.conversation_id,
    limit: input.limit,
  })

  return result.messages
}

export type InsertOutboundMessageInput = {
  organization_id: string
  conversation_id: string
  content: string
  content_type?: MessageContentType
  storage_path?: string | null
  mime_type?: string | null
  platform_media_id?: string | null
  file_size_bytes?: number | null
  send_source?: 'human' | 'agent'
}

export async function insertOutboundMessage(
  input: InsertOutboundMessageInput,
): Promise<MessageRecord> {
  const client = getSupabaseAdminClient()

  const { data, error } = await client
    .from('messages')
    .insert({
      organization_id: input.organization_id,
      conversation_id: input.conversation_id,
      participant_id: null,
      direction: 'outbound',
      platform_message_id: null,
      content: input.content,
      content_type: input.content_type ?? 'text',
      storage_path: input.storage_path ?? null,
      mime_type: input.mime_type ?? null,
      platform_media_id: input.platform_media_id ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      status: 'pending',
      send_source: input.send_source ?? 'human',
    })
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to send message')
  }

  const message = normalizeMessageRecord(data)
  await touchConversationOnNewMessage({
    organization_id: message.organization_id,
    conversation_id: message.conversation_id,
    message_at: message.created_at,
    content: message.content,
    content_type: message.content_type,
    direction: message.direction,
  })

  return message
}

export type UpdateMessageDeliveryStatusInput = {
  organization_id: string
  message_id: string
  status: MessageStatus
  platform_message_id?: string | null
  platform_media_id?: string | null
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
  const updatePayload: Record<string, unknown> = {
    status: input.status,
    platform_message_id: input.platform_message_id ?? null,
  }

  if (input.platform_media_id !== undefined) {
    updatePayload.platform_media_id = input.platform_media_id
  }

  const { data, error } = await client
    .from('messages')
    .update(updatePayload)
    .eq('organization_id', input.organization_id)
    .eq('id', input.message_id)
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update message status')
  }

  return normalizeMessageRecord(data)
}

export async function clearInboundMessageStoragePath(input: {
  organization_id: string
  message_id: string
}): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('messages')
    .update({ storage_path: null })
    .eq('organization_id', input.organization_id)
    .eq('id', input.message_id)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to clear message storage path')
  }
}

export async function updateInboundMessageMedia(input: {
  organization_id: string
  message_id: string
  storage_path: string
  mime_type: string
  file_size_bytes: number
  platform_media_id?: string | null
}): Promise<MessageRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .update({
      storage_path: input.storage_path,
      mime_type: input.mime_type,
      file_size_bytes: input.file_size_bytes,
      platform_media_id: input.platform_media_id ?? null,
    })
    .eq('organization_id', input.organization_id)
    .eq('id', input.message_id)
    .is('storage_path', null)
    .select(MESSAGE_COLUMNS)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update message media')
  }

  if (data === null) {
    const existing = await findMessageByIdForOrganization({
      organization_id: input.organization_id,
      message_id: input.message_id,
    })

    if (existing === null) {
      throw new AppError(404, 'NOT_FOUND', 'Message not found')
    }

    return existing
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

  const message = normalizeMessageRecord(data)
  await touchConversationOnNewMessage({
    organization_id: message.organization_id,
    conversation_id: message.conversation_id,
    message_at: message.created_at,
    content: message.content,
    content_type: message.content_type,
    direction: message.direction,
  })

  return message
}

export async function insertInboundMessage(
  input: InsertInboundMessageInput,
): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()

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

  const message = normalizeMessageRecord(data)
  await touchConversationOnNewMessage({
    organization_id: message.organization_id,
    conversation_id: message.conversation_id,
    message_at: message.created_at,
    content: message.content,
    content_type: message.content_type,
    direction: message.direction,
  })

  return message
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
    send_source: (row.send_source as 'human' | 'agent' | undefined) ?? 'human',
    created_at: row.created_at as string,
  }
}
