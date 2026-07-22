import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { GmailIntegrationMetadata } from '../integrations.constants.js'
import {
  INTEGRATION_CREDENTIAL_COLUMNS,
  normalizeIntegrationCredentialsRow,
  throwGmailCredentialStoreError,
  type IntegrationCredentialsRow,
} from './credentials.mapper.js'
import {
  findIntegrationByPlatform,
  INTEGRATION_PUBLIC_COLUMNS,
  normalizeIntegrationRecord,
  type IntegrationRecord,
} from './integration.repository.js'

export async function findGmailCredentialsByOrganization(
  organizationId: string,
): Promise<IntegrationCredentialsRow | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('integrations')
    .select(INTEGRATION_CREDENTIAL_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('platform', 'gmail')
    .eq('status', 'connected')
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load Gmail credentials')
  }

  if (data === null) {
    return null
  }

  return normalizeIntegrationCredentialsRow(data)
}

export async function upsertGmailCredentials(
  organizationId: string,
  input: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string | null
    metadata: GmailIntegrationMetadata
  },
): Promise<IntegrationRecord> {
  const existing = await findIntegrationByPlatform(organizationId, 'gmail')

  const client = getSupabaseAdminClient()
  const payload = {
    access_token: input.accessToken,
    refresh_token: input.refreshToken,
    token_expires_at: input.tokenExpiresAt,
    metadata: input.metadata,
    status: 'connected' as const,
  }

  if (existing !== null) {
    const { data, error } = await client
      .from('integrations')
      .update(payload)
      .eq('organization_id', organizationId)
      .eq('platform', 'gmail')
      .select(INTEGRATION_PUBLIC_COLUMNS)
      .single()

    if (error !== null || data === null) {
      throwGmailCredentialStoreError(error)
    }

    return normalizeIntegrationRecord(data)
  }

  const { data, error } = await client
    .from('integrations')
    .insert({
      organization_id: organizationId,
      platform: 'gmail',
      ...payload,
    })
    .select(INTEGRATION_PUBLIC_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throwGmailCredentialStoreError(error)
  }

  return normalizeIntegrationRecord(data)
}
