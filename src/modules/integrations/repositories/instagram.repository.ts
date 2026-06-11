import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { InstagramIntegrationMetadata } from '../integrations.constants.js'
import {
  INTEGRATION_CREDENTIAL_COLUMNS,
  normalizeIntegrationCredentialsRow,
  throwInstagramCredentialStoreError,
  type IntegrationCredentialsRow,
} from './credentials.mapper.js'
import {
  findIntegrationByPlatform,
  INTEGRATION_PUBLIC_COLUMNS,
  normalizeIntegrationRecord,
  type IntegrationRecord,
} from './integration.repository.js'

export async function findInstagramCredentialsByOrganization(
  organizationId: string,
): Promise<IntegrationCredentialsRow | null> {
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

  return normalizeIntegrationCredentialsRow(data)
}

export async function findConnectedInstagramByBusinessId(
  businessAccountId: string,
): Promise<IntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('platform', 'instagram')
    .eq('status', 'connected')
    .eq('metadata->>business_account_id', businessAccountId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to resolve Instagram integration')
  }

  if (data === null) {
    return null
  }

  return normalizeIntegrationCredentialsRow(data)
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
