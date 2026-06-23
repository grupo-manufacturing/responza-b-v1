import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { IntegrationPlatform } from '../../integrations/integrations.constants.js'
import type { MessageContentType } from '../inbox.schemas.js'
import type {
  ConversationListRecord,
  ConversationRecord,
  ConversationSendContext,
  ListConversationsInput,
} from './types.js'
import { formatMessageListPreview } from '../inbox.preview.js'

const CONVERSATION_COLUMNS =
  'id, organization_id, channel_id, external_id, last_message_at, created_at'

export async function listConversations(
  input: ListConversationsInput,
): Promise<ConversationListRecord[]> {
  const client = getSupabaseAdminClient()

  let query = client
    .from('conversations')
    .select(
      `
      ${CONVERSATION_COLUMNS},
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

  if (input.platform !== undefined) {
    query = query.eq('channels.platform', input.platform)
  }

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list conversations')
  }

  const records = (data ?? []).map(normalizeConversationListRecord)
  if (records.length === 0) {
    return records
  }

  const conversationIds = records.map((record) => record.id)
  const { data: messageRows, error: messagesError } = await client
    .from('messages')
    .select('conversation_id, content, content_type, created_at')
    .eq('organization_id', input.organizationId)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false })

  if (messagesError !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list conversations')
  }

  const lastMessageByConversation = new Map<string, string>()
  for (const row of messageRows ?? []) {
    const conversationId = row.conversation_id as string
    if (!lastMessageByConversation.has(conversationId)) {
      const content = row.content as string
      const contentType = (row.content_type as MessageContentType | undefined) ?? 'text'
      lastMessageByConversation.set(
        conversationId,
        formatMessageListPreview(content, contentType),
      )
    }
  }

  return records.map((record) => ({
    ...record,
    last_message_content: lastMessageByConversation.get(record.id) ?? null,
  }))
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
    last_message_content: null,
  }
}
