import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import {
  SUPPORTED_PLATFORMS,
  type IntegrationPlatform,
  type IntegrationStatus,
} from './integrations.constants.js'
import type {
  InstagramIntegrationCredentials,
  InstagramIntegrationMetadata,
  WhatsAppIntegrationCredentials,
  WhatsAppIntegrationMetadata,
} from './integrations.types.js'

export type IntegrationRecord = {
  id: string
  organization_id: string
  platform: IntegrationPlatform
  status: IntegrationStatus
}

type WhatsAppIntegrationCredentialsRow = IntegrationRecord & {
  access_token: string
  metadata: WhatsAppIntegrationMetadata
}

type InstagramIntegrationCredentialsRow = IntegrationRecord & {
  access_token: string
  metadata: InstagramIntegrationMetadata
}

const INTEGRATION_PUBLIC_COLUMNS = 'id, organization_id, platform, status'
const INTEGRATION_CREDENTIAL_COLUMNS =
  'id, organization_id, platform, status, access_token, metadata'

export async function listIntegrationsByOrganization(
  organizationId: string,
): Promise<IntegrationRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_PUBLIC_COLUMNS)
    .eq('organization_id', organizationId)

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
    .select(INTEGRATION_PUBLIC_COLUMNS)
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

export async function findWhatsAppCredentialsByOrganization(
  organizationId: string,
): Promise<WhatsAppIntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('platform', 'whatsapp')
    .eq('status', 'connected')
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load WhatsApp credentials')
  }

  if (data === null) {
    return null
  }

  return normalizeWhatsAppIntegrationCredentialsRow(data)
}

export async function findInstagramCredentialsByOrganization(
  organizationId: string,
): Promise<InstagramIntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load Instagram credentials')
  }

  if (data === null) {
    return null
  }

  return normalizeInstagramIntegrationCredentialsRow(data)
}

export async function findConnectedWhatsAppByPhoneNumberId(
  phoneNumberId: string,
): Promise<WhatsAppIntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('platform', 'whatsapp')
    .eq('status', 'connected')
    .eq('metadata->>phone_number_id', phoneNumberId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to resolve WhatsApp integration')
  }

  if (data === null) {
    return null
  }

  return normalizeWhatsAppIntegrationCredentialsRow(data)
}

export async function findConnectedWhatsAppByWabaId(
  wabaId: string,
): Promise<WhatsAppIntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('platform', 'whatsapp')
    .eq('status', 'connected')
    .eq('metadata->>waba_id', wabaId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to resolve WhatsApp integration')
  }

  if (data === null) {
    return null
  }

  return normalizeWhatsAppIntegrationCredentialsRow(data)
}

export async function findConnectedInstagramByIgUserId(
  igUserId: string,
): Promise<InstagramIntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .eq('metadata->>ig_user_id', igUserId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to resolve Instagram integration')
  }

  if (data === null) {
    return null
  }

  return normalizeInstagramIntegrationCredentialsRow(data)
}

export async function findConnectedInstagramByMessagingAccountId(
  messagingAccountId: string,
): Promise<InstagramIntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .eq('metadata->>messaging_account_id', messagingAccountId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to resolve Instagram integration')
  }

  if (data === null) {
    return null
  }

  return normalizeInstagramIntegrationCredentialsRow(data)
}

export async function upsertWhatsAppCredentials(
  organizationId: string,
  input: {
    accessToken: string
    metadata: WhatsAppIntegrationMetadata
  },
): Promise<IntegrationRecord> {
  const existing = await findIntegrationByPlatform(organizationId, 'whatsapp')

  const client = getSupabaseAdminClient()
  const payload = {
    access_token: input.accessToken,
    metadata: input.metadata,
    status: 'connected' as const,
  }

  if (existing !== null) {
    const { data, error } = await client
      .from('integrations')
      .update(payload)
      .eq('organization_id', organizationId)
      .eq('platform', 'whatsapp')
      .select(INTEGRATION_PUBLIC_COLUMNS)
      .single()

    if (error !== null || data === null) {
      throwWhatsAppCredentialStoreError(error)
    }

    return normalizeIntegrationRecord(data)
  }

  const { data, error } = await client
    .from('integrations')
    .insert({
      organization_id: organizationId,
      platform: 'whatsapp',
      ...payload,
    })
    .select(INTEGRATION_PUBLIC_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throwWhatsAppCredentialStoreError(error)
  }

  return normalizeIntegrationRecord(data)
}

export async function upsertInstagramCredentials(
  organizationId: string,
  input: {
    accessToken: string
    metadata: InstagramIntegrationMetadata
  },
): Promise<IntegrationRecord> {
  const existing = await findIntegrationByPlatform(organizationId, 'instagram')

  const client = getSupabaseAdminClient()
  const payload = {
    access_token: input.accessToken,
    metadata: input.metadata,
    status: 'connected' as const,
  }

  if (existing !== null) {
    const { data, error } = await client
      .from('integrations')
      .update(payload)
      .eq('organization_id', organizationId)
      .eq('platform', 'instagram')
      .select(INTEGRATION_PUBLIC_COLUMNS)
      .single()

    if (error !== null || data === null) {
      throwInstagramCredentialStoreError(error)
    }

    return normalizeIntegrationRecord(data)
  }

  const { data, error } = await client
    .from('integrations')
    .insert({
      organization_id: organizationId,
      platform: 'instagram',
      ...payload,
    })
    .select(INTEGRATION_PUBLIC_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throwInstagramCredentialStoreError(error)
  }

  return normalizeIntegrationRecord(data)
}

export async function updateInstagramMessagingAccountId(
  organizationId: string,
  messagingAccountId: string,
): Promise<IntegrationRecord | null> {
  const existing = await findInstagramCredentialsByOrganization(organizationId)
  if (existing === null) {
    return null
  }

  if (existing.metadata.messaging_account_id === messagingAccountId) {
    return normalizeIntegrationRecord(existing)
  }

  const metadata: InstagramIntegrationMetadata = {
    ...existing.metadata,
    messaging_account_id: messagingAccountId,
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .update({ metadata })
    .eq('organization_id', organizationId)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .select(INTEGRATION_PUBLIC_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update Instagram messaging account id')
  }

  return normalizeIntegrationRecord(data)
}

export async function setIntegrationDisconnected(
  organizationId: string,
  platform: IntegrationPlatform,
): Promise<IntegrationRecord> {
  const existing = await findIntegrationByPlatform(organizationId, platform)

  if (existing !== null) {
    if (existing.status === 'disconnected') {
      return existing
    }

    const client = getSupabaseAdminClient()
    const { data, error } = await client
      .from('integrations')
      .update({
        status: 'disconnected',
        access_token: null,
        metadata: null,
      })
      .eq('organization_id', organizationId)
      .eq('platform', platform)
      .select(INTEGRATION_PUBLIC_COLUMNS)
      .single()

    if (error !== null || data === null) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to disconnect integration')
    }

    return normalizeIntegrationRecord(data)
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .insert({
      organization_id: organizationId,
      platform,
      status: 'disconnected',
      access_token: null,
      metadata: null,
    })
    .select(INTEGRATION_PUBLIC_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to disconnect integration')
  }

  return normalizeIntegrationRecord(data)
}

export async function setIntegrationConnected(
  organizationId: string,
  platform: IntegrationPlatform,
): Promise<IntegrationRecord> {
  const existing = await findIntegrationByPlatform(organizationId, platform)

  if (existing !== null) {
    if (existing.status === 'connected') {
      return existing
    }

    const client = getSupabaseAdminClient()
    const { data, error } = await client
      .from('integrations')
      .update({ status: 'connected' })
      .eq('organization_id', organizationId)
      .eq('platform', platform)
      .select(INTEGRATION_PUBLIC_COLUMNS)
      .single()

    if (error !== null || data === null) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to connect integration')
    }

    return normalizeIntegrationRecord(data)
  }

  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .insert({
      organization_id: organizationId,
      platform,
      status: 'connected',
    })
    .select(INTEGRATION_PUBLIC_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to connect integration')
  }

  return normalizeIntegrationRecord(data)
}

export async function hasConnectedIntegration(
  organizationId: string,
  platform?: IntegrationPlatform,
): Promise<boolean> {
  const client = getSupabaseAdminClient()

  let query = client
    .from('integrations')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'connected')
    .limit(1)

  if (platform !== undefined) {
    query = query.eq('platform', platform)
  }

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to check integration status')
  }

  return (data ?? []).length > 0
}

export async function listConnectedPlatforms(organizationId: string): Promise<IntegrationPlatform[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select('platform')
    .eq('organization_id', organizationId)
    .eq('status', 'connected')

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list connected integrations')
  }

  return (data ?? [])
    .map((row) => row.platform as IntegrationPlatform)
    .filter((platform) => SUPPORTED_PLATFORMS.includes(platform))
}

function throwWhatsAppCredentialStoreError(error: { code?: string } | null): never {
  if (error?.code === '23505') {
    throw new AppError(
      409,
      'CONFLICT',
      'This WhatsApp phone number is already connected to another organization',
    )
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Failed to store WhatsApp credentials')
}

function throwInstagramCredentialStoreError(error: { code?: string } | null): never {
  if (error?.code === '23505') {
    throw new AppError(
      409,
      'CONFLICT',
      'This Instagram account is already connected to another organization',
    )
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Failed to store Instagram credentials')
}

function normalizeIntegrationRecord(row: Record<string, unknown>): IntegrationRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    platform: row.platform as IntegrationPlatform,
    status: row.status as IntegrationStatus,
  }
}

function normalizeWhatsAppIntegrationCredentialsRow(
  row: Record<string, unknown>,
): WhatsAppIntegrationCredentialsRow {
  const rawMetadata = row.metadata
  if (rawMetadata === null || typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is invalid')
  }

  const metadata = rawMetadata as Record<string, unknown>
  const phoneNumberId = metadata.phone_number_id
  const wabaId = metadata.waba_id
  if (typeof phoneNumberId !== 'string' || phoneNumberId.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing phone_number_id')
  }
  if (typeof wabaId !== 'string' || wabaId.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing waba_id')
  }

  const accessToken = row.access_token
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration access token is missing')
  }

  const businessId = metadata['business_id']
  const normalizedMetadata: WhatsAppIntegrationMetadata = {
    phone_number_id: phoneNumberId,
    waba_id: wabaId,
    ...(typeof businessId === 'string' && businessId.length > 0
      ? { business_id: businessId }
      : {}),
  }

  return {
    ...normalizeIntegrationRecord(row),
    access_token: accessToken,
    metadata: normalizedMetadata,
  }
}

function normalizeInstagramIntegrationCredentialsRow(
  row: Record<string, unknown>,
): InstagramIntegrationCredentialsRow {
  const rawMetadata = row.metadata
  if (rawMetadata === null || typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is invalid')
  }

  const metadata = rawMetadata as Record<string, unknown>
  const igUserId = metadata.ig_user_id
  const igUsername = metadata.ig_username
  if (typeof igUserId !== 'string' || igUserId.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing ig_user_id')
  }
  if (typeof igUsername !== 'string' || igUsername.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing ig_username')
  }

  const accessToken = row.access_token
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration access token is missing')
  }

  const messagingAccountId = metadata.messaging_account_id
  const normalizedMetadata: InstagramIntegrationMetadata = {
    ig_user_id: igUserId,
    ig_username: igUsername,
    ...(typeof messagingAccountId === 'string' && messagingAccountId.length > 0
      ? { messaging_account_id: messagingAccountId }
      : {}),
  }

  return {
    ...normalizeIntegrationRecord(row),
    access_token: accessToken,
    metadata: normalizedMetadata,
  }
}

export function toWhatsAppIntegrationCredentials(
  row: WhatsAppIntegrationCredentialsRow,
): WhatsAppIntegrationCredentials {
  return {
    integrationId: row.id,
    organizationId: row.organization_id,
    accessToken: row.access_token,
    metadata: row.metadata,
  }
}

export function toInstagramIntegrationCredentials(
  row: InstagramIntegrationCredentialsRow,
): InstagramIntegrationCredentials {
  return {
    integrationId: row.id,
    organizationId: row.organization_id,
    accessToken: row.access_token,
    metadata: row.metadata,
  }
}

/** @deprecated Use toWhatsAppIntegrationCredentials */
export function toIntegrationCredentials(
  row: WhatsAppIntegrationCredentialsRow,
): WhatsAppIntegrationCredentials {
  return toWhatsAppIntegrationCredentials(row)
}
