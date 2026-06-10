import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { IntegrationPlatform } from '../integrations/integrations.constants.js'
import type { MessageDirection, MessageStatus } from './inbox.constants.js'

export type ChannelRecord = {
  id: string
  organization_id: string
  integration_id: string
  platform: IntegrationPlatform
  display_name: string
  created_at: string
}

export type ConversationRecord = {
  id: string
  organization_id: string
  channel_id: string
  external_id: string
  last_message_at: string
  created_at: string
}

export type ConversationSendContext = ConversationRecord & {
  platform: IntegrationPlatform
  integration_id: string
}

export type ConversationListRecord = ConversationRecord & {
  platform: IntegrationPlatform
  channel_display_name: string
  contact_participant_id: string | null
  contact_platform_user_id: string | null
  contact_display_name: string | null
  contact_avatar_url: string | null
  last_message_content: string | null
}

export type ParticipantRecord = {
  id: string
  organization_id: string
  conversation_id: string
  platform_user_id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export type MessageRecord = {
  id: string
  organization_id: string
  conversation_id: string
  participant_id: string | null
  direction: MessageDirection
  platform_message_id: string | null
  content: string
  status: MessageStatus
  created_at: string
}

const CHANNEL_COLUMNS = 'id, organization_id, integration_id, platform, display_name, created_at'
const CONVERSATION_COLUMNS =
  'id, organization_id, channel_id, external_id, last_message_at, created_at'
const PARTICIPANT_COLUMNS =
  'id, organization_id, conversation_id, platform_user_id, display_name, avatar_url, created_at'
const MESSAGE_COLUMNS =
  'id, organization_id, conversation_id, participant_id, direction, platform_message_id, content, status, created_at'

export type ListConversationsInput = {
  organizationId: string
  platform?: IntegrationPlatform
}

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
    .select('conversation_id, content, created_at')
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
      lastMessageByConversation.set(conversationId, row.content as string)
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

  if (data === null) {
    return null
  }

  return normalizeConversationRecord(data)
}

export async function listParticipantsByConversationId(
  organizationId: string,
  conversationId: string,
): Promise<ParticipantRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list participants')
  }

  return (data ?? []).map(normalizeParticipantRecord)
}

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

export type FindChannelByIntegrationInput = {
  organizationId: string
  integrationId: string
}

export async function findChannelByIntegration(
  input: FindChannelByIntegrationInput,
): Promise<ChannelRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('channels')
    .select(CHANNEL_COLUMNS)
    .eq('organization_id', input.organizationId)
    .eq('integration_id', input.integrationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load channel')
  }

  if (data === null) {
    return null
  }

  return normalizeChannelRecord(data)
}

export type InsertChannelInput = {
  organization_id: string
  integration_id: string
  platform: IntegrationPlatform
  display_name: string
}

export async function insertChannel(input: InsertChannelInput): Promise<ChannelRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('channels')
    .insert(input)
    .select(CHANNEL_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create channel')
  }

  return normalizeChannelRecord(data)
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

export type FindParticipantInput = {
  organizationId: string
  conversationId: string
  platformUserId: string
}

export async function findParticipant(input: FindParticipantInput): Promise<ParticipantRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('participants')
    .select(PARTICIPANT_COLUMNS)
    .eq('organization_id', input.organizationId)
    .eq('conversation_id', input.conversationId)
    .eq('platform_user_id', input.platformUserId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load participant')
  }

  if (data === null) {
    return null
  }

  return normalizeParticipantRecord(data)
}

export type InsertParticipantInput = {
  organization_id: string
  conversation_id: string
  platform_user_id: string
  display_name: string
  avatar_url?: string | null
}

export async function insertParticipant(input: InsertParticipantInput): Promise<ParticipantRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('participants')
    .insert({
      organization_id: input.organization_id,
      conversation_id: input.conversation_id,
      platform_user_id: input.platform_user_id,
      display_name: input.display_name,
      avatar_url: input.avatar_url ?? null,
    })
    .select(PARTICIPANT_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create participant')
  }

  return normalizeParticipantRecord(data)
}

export type UpdateParticipantProfileInput = {
  organization_id: string
  participant_id: string
  display_name: string
  avatar_url: string | null
}

export async function updateParticipantProfile(
  input: UpdateParticipantProfileInput,
): Promise<ParticipantRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('participants')
    .update({
      display_name: input.display_name,
      avatar_url: input.avatar_url,
    })
    .eq('organization_id', input.organization_id)
    .eq('id', input.participant_id)
    .select(PARTICIPANT_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update participant profile')
  }

  return normalizeParticipantRecord(data)
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

function normalizeChannelRecord(row: Record<string, unknown>): ChannelRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    integration_id: row.integration_id as string,
    platform: row.platform as IntegrationPlatform,
    display_name: row.display_name as string,
    created_at: row.created_at as string,
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
    last_message_content: null,
  }
}

function normalizeParticipantRecord(row: Record<string, unknown>): ParticipantRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    conversation_id: row.conversation_id as string,
    platform_user_id: row.platform_user_id as string,
    display_name: row.display_name as string,
    avatar_url: (row.avatar_url as string | null) ?? null,
    created_at: row.created_at as string,
  }
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
