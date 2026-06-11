import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import {
  SUPPORTED_PLATFORMS,
  type IntegrationPlatform,
  type IntegrationStatus,
} from '../integrations.constants.js'

export type IntegrationRecord = {
  id: string
  organization_id: string
  platform: IntegrationPlatform
  status: IntegrationStatus
}

export const INTEGRATION_PUBLIC_COLUMNS = 'id, organization_id, platform, status'

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

export function normalizeIntegrationRecord(row: Record<string, unknown>): IntegrationRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    platform: row.platform as IntegrationPlatform,
    status: row.status as IntegrationStatus,
  }
}
