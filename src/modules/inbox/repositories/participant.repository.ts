import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { ParticipantRecord } from './types.js'

const PARTICIPANT_COLUMNS =
  'id, organization_id, conversation_id, platform_user_id, display_name, avatar_url, created_at'

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
