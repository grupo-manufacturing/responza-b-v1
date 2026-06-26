import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { IntegrationPlatform } from '../../integrations/integrations.constants.js'
import type { MessageContentType, MessageDirection } from '../inbox.schemas.js'
import {
  conversationListCursorFilter,
  decodeConversationListCursor,
  encodeConversationListCursor,
  MAX_CONVERSATION_LIST_LIMIT,
} from '../conversation.pagination.js'
import { formatMessageListPreview } from '../inbox.preview.js'
import type {
  ConversationListRecord,
  ConversationRecord,
  ConversationSendContext,
  ListConversationsInput,
  ListConversationsResult,
} from './types.js'

const CONVERSATION_COLUMNS =
  'id, organization_id, channel_id, external_id, last_message_at, created_at'

const CONVERSATION_LIST_COLUMNS =
  'id, organization_id, channel_id, external_id, last_message_at, last_message_preview, last_message_direction, created_at'

export async function listConversations(
  input: ListConversationsInput,
): Promise<ListConversationsResult> {
  const client = getSupabaseAdminClient()
  const paginate = input.limit !== undefined
  const pageSize = paginate
    ? Math.min(Math.max(1, input.limit ?? 1), MAX_CONVERSATION_LIST_LIMIT)
    : null

  if (input.cursor !== undefined) {
    const decoded = decodeConversationListCursor(input.cursor)
    if (decoded === null) {
      throw new AppError(400, 'BAD_REQUEST', 'Invalid conversation cursor')
    }
  }

  let query = client
    .from('conversations')
    .select(
      `
      ${CONVERSATION_LIST_COLUMNS},
      channels!inner (
        platform,
        display_name
      ),
      participants (
        id,
        platform_user_id,
        display_name,
        avatar_url
      )
    `,
    )
    .eq('organization_id', input.organizationId)
    .order('last_message_at', { ascending: false })
    .order('id', { ascending: false })

  if (input.platform !== undefined) {
    query = query.eq('channels.platform', input.platform)
  }

  if (input.cursor !== undefined) {
    const decoded = decodeConversationListCursor(input.cursor)
    if (decoded !== null) {
      query = query.or(conversationListCursorFilter(decoded))
    }
  }

  if (pageSize !== null) {
    query = query.limit(pageSize + 1)
  }

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list conversations')
  }

  let conversations = (data ?? []).map(normalizeConversationListRecord)

  let hasMore = false
  let nextCursor: string | null = null

  if (pageSize !== null && conversations.length > pageSize) {
    hasMore = true
    conversations = conversations.slice(0, pageSize)
    const lastConversation = conversations[conversations.length - 1]
    if (lastConversation !== undefined) {
      nextCursor = encodeConversationListCursor({
        lastMessageAt: lastConversation.last_message_at,
        id: lastConversation.id,
      })
    }
  }

  return {
    conversations,
    nextCursor,
    hasMore,
  }
}

export async function findConversationSendContext(
  organizationId: string,
  conversationId: string,
): Promise<ConversationSendContext | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('conversations')
    .select(
      `
      ${CONVERSATION_COLUMNS},
      channels!inner (
        platform,
        integration_id
      )
    `,
    )
    .eq('organization_id', organizationId)
    .eq('id', conversationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load conversation')
  }

  if (data === null) {
    return null
  }

  const channel = data.channels as Record<string, unknown> | Record<string, unknown>[] | null
  const channelRow = Array.isArray(channel) ? channel[0] : channel

  if (channelRow === null || channelRow === undefined) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load conversation channel')
  }

  return {
    ...normalizeConversationRecord(data),
    platform: channelRow.platform as IntegrationPlatform,
    integration_id: channelRow.integration_id as string,
  }
}

export type FindConversationByExternalIdInput = {
  organizationId: string
  channelId: string
  externalId: string
}

export async function findConversationByExternalId(
  input: FindConversationByExternalIdInput,
): Promise<ConversationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('conversations')
    .select(CONVERSATION_COLUMNS)
    .eq('organization_id', input.organizationId)
    .eq('channel_id', input.channelId)
    .eq('external_id', input.externalId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load conversation')
  }

  if (data === null) {
    return null
  }

  return normalizeConversationRecord(data)
}

export type InsertConversationInput = {
  organization_id: string
  channel_id: string
  external_id: string
  last_message_at?: string
}

export async function insertConversation(
  input: InsertConversationInput,
): Promise<ConversationRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('conversations')
    .insert({
      organization_id: input.organization_id,
      channel_id: input.channel_id,
      external_id: input.external_id,
      last_message_at: input.last_message_at ?? new Date().toISOString(),
    })
    .select(CONVERSATION_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create conversation')
  }

  return normalizeConversationRecord(data)
}

export type TouchConversationOnNewMessageInput = {
  organization_id: string
  conversation_id: string
  message_at: string
  content: string
  content_type: MessageContentType
  direction: MessageDirection
}

export async function touchConversationOnNewMessage(
  input: TouchConversationOnNewMessageInput,
): Promise<void> {
  const client = getSupabaseAdminClient()
  const preview = formatMessageListPreview(input.content, input.content_type)

  const { error } = await client
    .from('conversations')
    .update({
      last_message_at: input.message_at,
      last_message_preview: preview,
      last_message_direction: input.direction,
    })
    .eq('organization_id', input.organization_id)
    .eq('id', input.conversation_id)
    .lte('last_message_at', input.message_at)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update conversation')
  }
}

function normalizeConversationRecord(row: Record<string, unknown>): ConversationRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    channel_id: row.channel_id as string,
    external_id: row.external_id as string,
    last_message_at: row.last_message_at as string,
    created_at: row.created_at as string,
  }
}

function normalizeConversationListRecord(row: Record<string, unknown>): ConversationListRecord {
  const channel = row.channels as Record<string, unknown> | Record<string, unknown>[] | null
  const channelRow = Array.isArray(channel) ? channel[0] : channel

  if (channelRow === null || channelRow === undefined) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list conversations')
  }

  const participants = row.participants as
    | Array<{
        id: string
        platform_user_id: string
        display_name: string
        avatar_url: string | null
      }>
    | {
        id: string
        platform_user_id: string
        display_name: string
        avatar_url: string | null
      }
    | null
  const participantRows = Array.isArray(participants)
    ? participants
    : participants !== null
      ? [participants]
      : []
  const primaryParticipant = participantRows[0]

  return {
    ...normalizeConversationRecord(row),
    platform: channelRow.platform as IntegrationPlatform,
    channel_display_name: channelRow.display_name as string,
    contact_participant_id: primaryParticipant?.id ?? null,
    contact_platform_user_id: primaryParticipant?.platform_user_id ?? null,
    contact_display_name: primaryParticipant?.display_name ?? null,
    contact_avatar_url: primaryParticipant?.avatar_url ?? null,
    last_message_content: (row.last_message_preview as string | null) ?? null,
  }
}
