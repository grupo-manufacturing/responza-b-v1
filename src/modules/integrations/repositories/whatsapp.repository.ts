import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { WhatsAppIntegrationMetadata } from '../integrations.constants.js'
import {
  INTEGRATION_CREDENTIAL_COLUMNS,
  normalizeIntegrationCredentialsRow,
  throwWhatsAppCredentialStoreError,
  type IntegrationCredentialsRow,
} from './credentials.mapper.js'
import {
  findIntegrationByPlatform,
  INTEGRATION_PUBLIC_COLUMNS,
  normalizeIntegrationRecord,
  type IntegrationRecord,
} from './integration.repository.js'

export async function findWhatsAppCredentialsByOrganization(
  organizationId: string,
): Promise<IntegrationCredentialsRow | null> {
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

  return normalizeIntegrationCredentialsRow(data)
}

export async function findConnectedWhatsAppByPhoneNumberId(
  phoneNumberId: string,
): Promise<IntegrationCredentialsRow | null> {
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

  return normalizeIntegrationCredentialsRow(data)
}

export async function findConnectedWhatsAppByWabaId(
  wabaId: string,
): Promise<IntegrationCredentialsRow | null> {
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

  return normalizeIntegrationCredentialsRow(data)
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
