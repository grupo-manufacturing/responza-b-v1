import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import { decodeCursor, encodeCursor, type CursorPayload } from '../../shared/pagination/cursor.js'
import type { InboxPlatform } from './inbox.constants.js'
import type { MessageContentType, MessageDirection, MessageStatus } from './inbox.constants.js'

export type ChannelRecord = {
  id: string
  organization_id: string
  integration_id: string
  platform: InboxPlatform
  display_name: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ConversationRecord = {
  id: string
  organization_id: string
  channel_id: string
  external_id: string
  last_message_at: string | null
  unread_count: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ParticipantRecord = {
  id: string
  conversation_id: string
  platform_user_id: string
  display_name: string | null
  avatar_url: string | null
  metadata: Record<string, unknown>
  first_message_at: string | null
  last_message_at: string | null
  created_at: string
  updated_at: string
}

export type MessageRecord = {
  id: string
  conversation_id: string
  participant_id: string | null
  direction: MessageDirection
  platform_message_id: string | null
  content_type: MessageContentType
  body: string | null
  file_url: string | null
  metadata: Record<string, unknown>
  status: MessageStatus
  created_at: string
  updated_at: string
}

const CHANNEL_COLUMNS =
  'id, organization_id, integration_id, platform, display_name, metadata, created_at, updated_at'

const CONVERSATION_COLUMNS =
  'id, organization_id, channel_id, external_id, last_message_at, unread_count, metadata, created_at, updated_at'

const PARTICIPANT_COLUMNS =
  'id, conversation_id, platform_user_id, display_name, avatar_url, metadata, first_message_at, last_message_at, created_at, updated_at'

const MESSAGE_COLUMNS =
  'id, conversation_id, participant_id, direction, platform_message_id, content_type, body, file_url, metadata, status, created_at, updated_at'

export async function findChannelById(
  organizationId: string,
  channelId: string,
): Promise<ChannelRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('channels')
    .select(CHANNEL_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('id', channelId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load channel')
  }

  return data === null ? null : normalizeChannelRecord(data)
}

export async function upsertChannel(input: {
  organization_id: string
  integration_id: string
  platform: InboxPlatform
  display_name: string
  metadata?: Record<string, unknown>
}): Promise<ChannelRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('channels')
    .upsert(
      {
        organization_id: input.organization_id,
        integration_id: input.integration_id,
        platform: input.platform,
        display_name: input.display_name,
        metadata: input.metadata ?? {},
        updated_at: now,
      },
      { onConflict: 'integration_id' },
    )
    .select(CHANNEL_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to save channel')
  }

  return normalizeChannelRecord(data)
}

export async function listChannelsByOrganization(organizationId: string): Promise<ChannelRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('channels')
    .select(CHANNEL_COLUMNS)
    .eq('organization_id', organizationId)
    .order('platform', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list channels')
  }

  return (data ?? []).map(normalizeChannelRecord)
}

export type ListConversationsInput = {
  organizationId: string
  limit: number
  cursor?: string
  platform?: InboxPlatform
  channelIds?: string[]
}

export type ListConversationsResult = {
  conversations: ConversationRecord[]
  nextCursor: string | null
}

export async function listConversations(
  input: ListConversationsInput,
): Promise<ListConversationsResult> {
  if (input.channelIds !== undefined && input.channelIds.length === 0) {
    return { conversations: [], nextCursor: null }
  }

  const client = getSupabaseAdminClient()
  const fetchLimit = input.limit + 1

  let query = client
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('organization_id', input.organizationId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit)

  if (input.channelIds !== undefined) {
    query = query.in('channel_id', input.channelIds)
  }

  if (input.cursor !== undefined) {
    const decoded = decodeCursor(input.cursor)
    query = query.or(
      `last_message_at.lt.${decoded.createdAt},and(last_message_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    )
  }

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list conversations')
  }

  const rows = (data ?? []).map(normalizeConversationRecord)
  const hasMore = rows.length > input.limit
  const conversations = hasMore ? rows.slice(0, input.limit) : rows

  let nextCursor: string | null = null
  if (hasMore) {
    const last = conversations[conversations.length - 1]
    if (last !== undefined) {
      const cursorTime = last.last_message_at ?? last.created_at
      nextCursor = encodeCursor({ createdAt: cursorTime, id: last.id } satisfies CursorPayload)
    }
  }

  return { conversations, nextCursor }
}

export async function findConversationByChannelAndExternalId(
  channelId: string,
  externalId: string,
): Promise<ConversationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('channel_id', channelId)
    .eq('external_id', externalId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load conversation')
  }

  return data === null ? null : normalizeConversationRecord(data)
}

export async function findOrCreateConversation(input: {
  organization_id: string
  channel_id: string
  external_id: string
  metadata?: Record<string, unknown>
}): Promise<ConversationRecord> {
  const existing = await findConversationByChannelAndExternalId(input.channel_id, input.external_id)
  if (existing !== null) {
    return existing
  }

  try {
    return await insertConversation(input)
  } catch (error) {
    const raced = await findConversationByChannelAndExternalId(input.channel_id, input.external_id)
    if (raced !== null) {
      return raced
    }

    throw error
  }
}

export async function findConversationById(
  organizationId: string,
  conversationId: string,
): Promise<ConversationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('id', conversationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load conversation')
  }

  return data === null ? null : normalizeConversationRecord(data)
}

/** Internal — used when ingesting platform messages (Phase 5+). */
export async function insertConversation(input: {
  organization_id: string
  channel_id: string
  external_id: string
  metadata?: Record<string, unknown>
}): Promise<ConversationRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('conversations')
    .insert({
      organization_id: input.organization_id,
      channel_id: input.channel_id,
      external_id: input.external_id,
      last_message_at: now,
      metadata: input.metadata ?? {},
      updated_at: now,
    })
    .select(CONVERSATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create conversation')
  }

  return normalizeConversationRecord(data)
}

export async function touchConversationAfterMessage(
  organizationId: string,
  conversationId: string,
  messageCreatedAt: string,
  options: { incrementUnread?: boolean } = {},
): Promise<void> {
  const existing = await findConversationById(organizationId, conversationId)
  if (existing === null) {
    return
  }

  const client = getSupabaseAdminClient()
  const unreadCount =
    options.incrementUnread === true ? existing.unread_count + 1 : existing.unread_count

  const { error } = await client
    .from('conversations')
    .update({
      last_message_at: messageCreatedAt,
      unread_count: unreadCount,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('id', conversationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update conversation activity')
  }
}

/** Internal — used when ingesting platform messages (Phase 5+). */
export async function findParticipantByConversationAndPlatformUserId(
  conversationId: string,
  platformUserId: string,
): Promise<ParticipantRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('conversation_id', conversationId)
    .eq('platform_user_id', platformUserId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load participant')
  }

  return data === null ? null : normalizeParticipantRecord(data)
}

export async function findOrCreateParticipant(input: {
  conversation_id: string
  platform_user_id: string
  display_name?: string | null
  avatar_url?: string | null
  metadata?: Record<string, unknown>
}): Promise<ParticipantRecord> {
  const existing = await findParticipantByConversationAndPlatformUserId(
    input.conversation_id,
    input.platform_user_id,
  )

  if (existing !== null) {
    if (
      (existing.display_name === null || existing.display_name.trim().length === 0) &&
      input.display_name !== undefined &&
      input.display_name !== null &&
      input.display_name.trim().length > 0
    ) {
      const client = getSupabaseAdminClient()
      const { data, error } = await client
        .from('participants')
        .update({
          display_name: input.display_name.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select(PARTICIPANT_COLUMNS)
        .single()

      if (error === null && data !== null) {
        return normalizeParticipantRecord(data)
      }
    }

    return existing
  }

  try {
    return await insertParticipant(input)
  } catch (error) {
    const raced = await findParticipantByConversationAndPlatformUserId(
      input.conversation_id,
      input.platform_user_id,
    )
    if (raced !== null) {
      return raced
    }

    throw error
  }
}

export async function insertParticipant(input: {
  conversation_id: string
  platform_user_id: string
  display_name?: string | null
  avatar_url?: string | null
  metadata?: Record<string, unknown>
}): Promise<ParticipantRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('participants')
    .insert({
      conversation_id: input.conversation_id,
      platform_user_id: input.platform_user_id,
      display_name: input.display_name ?? null,
      avatar_url: input.avatar_url ?? null,
      metadata: input.metadata ?? {},
      first_message_at: now,
      last_message_at: now,
      updated_at: now,
    })
    .select(PARTICIPANT_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create participant')
  }

  return normalizeParticipantRecord(data)
}

export async function listParticipantsByConversation(
  conversationId: string,
): Promise<ParticipantRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list participants')
  }

  return (data ?? []).map(normalizeParticipantRecord)
}

export async function findPrimaryParticipant(
  conversationId: string,
): Promise<ParticipantRecord | null> {
  const participants = await listParticipantsByConversation(conversationId)
  return participants[0] ?? null
}

export type ListMessagesInput = {
  conversationId: string
  limit: number
  cursor?: string
  direction?: MessageDirection
}

export type ListMessagesResult = {
  messages: MessageRecord[]
  nextCursor: string | null
}

export async function listMessages(input: ListMessagesInput): Promise<ListMessagesResult> {
  const client = getSupabaseAdminClient()
  const fetchLimit = input.limit + 1

  let query = client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', input.conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit)

  if (input.direction !== undefined) {
    query = query.eq('direction', input.direction)
  }

  if (input.cursor !== undefined) {
    const decoded = decodeCursor(input.cursor)
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    )
  }

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list messages')
  }

  const rows = (data ?? []).map(normalizeMessageRecord)
  const hasMore = rows.length > input.limit
  const messages = hasMore ? rows.slice(0, input.limit) : rows

  let nextCursor: string | null = null
  if (hasMore) {
    const last = messages[messages.length - 1]
    if (last !== undefined) {
      nextCursor = encodeCursor({ createdAt: last.created_at, id: last.id } satisfies CursorPayload)
    }
  }

  return { messages, nextCursor }
}

export async function findMessageByPlatformMessageId(
  platformMessageId: string,
): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('platform_message_id', platformMessageId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load message')
  }

  return data === null ? null : normalizeMessageRecord(data)
}

export async function insertMessage(input: {
  conversation_id: string
  participant_id: string | null
  direction: MessageDirection
  content_type: MessageContentType
  body?: string | null
  file_url?: string | null
  status: MessageStatus
  metadata?: Record<string, unknown>
  platform_message_id?: string | null
}): Promise<MessageRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('messages')
    .insert({
      conversation_id: input.conversation_id,
      participant_id: input.participant_id,
      direction: input.direction,
      content_type: input.content_type,
      body: input.body ?? null,
      file_url: input.file_url ?? null,
      status: input.status,
      metadata: input.metadata ?? {},
      platform_message_id: input.platform_message_id ?? null,
      updated_at: now,
    })
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create message')
  }

  return normalizeMessageRecord(data)
}

export async function updateMessageStatus(
  messageId: string,
  status: MessageStatus,
  options: { platformMessageId?: string } = {},
): Promise<MessageRecord> {
  const client = getSupabaseAdminClient()
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (options.platformMessageId !== undefined) {
    patch.platform_message_id = options.platformMessageId
  }

  const { data, error } = await client
    .from('messages')
    .update(patch)
    .eq('id', messageId)
    .select(MESSAGE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update message status')
  }

  return normalizeMessageRecord(data)
}

export async function findLatestMessageByConversation(
  conversationId: string,
): Promise<MessageRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('messages')
    .select(MESSAGE_COLUMNS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load latest message')
  }

  return data === null ? null : normalizeMessageRecord(data)
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeChannelRecord(row: Record<string, unknown>): ChannelRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    integration_id: row.integration_id as string,
    platform: row.platform as InboxPlatform,
    display_name: row.display_name as string,
    metadata: normalizeJsonObject(row.metadata),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function normalizeConversationRecord(row: Record<string, unknown>): ConversationRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    channel_id: row.channel_id as string,
    external_id: row.external_id as string,
    last_message_at: (row.last_message_at as string | null) ?? null,
    unread_count: row.unread_count as number,
    metadata: normalizeJsonObject(row.metadata),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function normalizeParticipantRecord(row: Record<string, unknown>): ParticipantRecord {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    platform_user_id: row.platform_user_id as string,
    display_name: (row.display_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    metadata: normalizeJsonObject(row.metadata),
    first_message_at: (row.first_message_at as string | null) ?? null,
    last_message_at: (row.last_message_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function normalizeMessageRecord(row: Record<string, unknown>): MessageRecord {
  return {
    id: row.id as string,
    conversation_id: row.conversation_id as string,
    participant_id: (row.participant_id as string | null) ?? null,
    direction: row.direction as MessageDirection,
    platform_message_id: (row.platform_message_id as string | null) ?? null,
    content_type: row.content_type as MessageContentType,
    body: (row.body as string | null) ?? null,
    file_url: (row.file_url as string | null) ?? null,
    metadata: normalizeJsonObject(row.metadata),
    status: row.status as MessageStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}
