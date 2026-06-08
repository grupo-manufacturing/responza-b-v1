import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { IntegrationPlatform, IntegrationStatus } from './integrations.constants.js'

export type IntegrationRecord = {
  id: string
  organization_id: string
  platform: IntegrationPlatform
  status: IntegrationStatus
  access_token: string | null
  metadata: Record<string, unknown>
  connected_at: string | null
  disconnected_at: string | null
  created_at: string
  updated_at: string
}

const INTEGRATION_COLUMNS_WITH_CREDENTIALS =
  'id, organization_id, platform, status, access_token, metadata, connected_at, disconnected_at, created_at, updated_at'

export type UpsertIntegrationInput = {
  organization_id: string
  platform: IntegrationPlatform
  status: IntegrationStatus
  connected_at: string | null
  disconnected_at: string | null
  access_token?: string | null
  metadata?: Record<string, unknown>
}

export async function listIntegrationsByOrganization(
  organizationId: string,
): Promise<IntegrationRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_COLUMNS_WITH_CREDENTIALS)
    .eq('organization_id', organizationId)
    .order('platform', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list integrations')
  }

  return (data ?? []).map(normalizeIntegrationRecord)
}

export async function findIntegrationByPlatform(
  organizationId: string,
  platform: IntegrationPlatform,
): Promise<IntegrationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_COLUMNS_WITH_CREDENTIALS)
    .eq('organization_id', organizationId)
    .eq('platform', platform)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load integration')
  }

  if (data === null) {
    return null
  }

  return normalizeIntegrationRecord(data)
}

export async function findConnectedWhatsAppByPhoneNumberId(
  phoneNumberId: string,
): Promise<IntegrationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_COLUMNS_WITH_CREDENTIALS)
    .eq('platform', 'whatsapp')
    .eq('status', 'connected')
    .eq('metadata->>phone_number_id', phoneNumberId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to resolve WhatsApp integration')
  }

  return data === null ? null : normalizeIntegrationRecord(data)
}

export async function findConnectedWhatsAppByWabaId(
  wabaId: string,
): Promise<IntegrationRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_COLUMNS_WITH_CREDENTIALS)
    .eq('platform', 'whatsapp')
    .eq('status', 'connected')
    .eq('metadata->>waba_id', wabaId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to resolve WhatsApp integration')
  }

  return data === null ? null : normalizeIntegrationRecord(data)
}

export async function upsertIntegration(
  input: UpsertIntegrationInput,
): Promise<IntegrationRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const row: Record<string, unknown> = {
    organization_id: input.organization_id,
    platform: input.platform,
    status: input.status,
    connected_at: input.connected_at,
    disconnected_at: input.disconnected_at,
    updated_at: now,
  }

  if (input.access_token !== undefined) {
    row.access_token = input.access_token
  }

  if (input.metadata !== undefined) {
    row.metadata = input.metadata
  }

  const { data, error } = await client
    .from('integrations')
    .upsert(row, { onConflict: 'organization_id,platform' })
    .select(INTEGRATION_COLUMNS_WITH_CREDENTIALS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to save integration')
  }

  return normalizeIntegrationRecord(data)
}

export async function countConnectedIntegrations(
  organizationId: string,
  platform?: IntegrationPlatform,
): Promise<number> {
  const client = getSupabaseAdminClient()

  let query = client
    .from('integrations')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'connected')

  if (platform !== undefined) {
    query = query.eq('platform', platform)
  }

  const { count, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to check integrations')
  }

  return count ?? 0
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function normalizeIntegrationRecord(row: Record<string, unknown>): IntegrationRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    platform: row.platform as IntegrationPlatform,
    status: row.status as IntegrationStatus,
    access_token: (row.access_token as string | null) ?? null,
    metadata: normalizeJsonObject(row.metadata),
    connected_at: (row.connected_at as string | null) ?? null,
    disconnected_at: (row.disconnected_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}
