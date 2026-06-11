import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { IntegrationPlatform } from '../../integrations/integrations.constants.js'
import type { ChannelRecord } from './types.js'

const CHANNEL_COLUMNS = 'id, organization_id, integration_id, platform, display_name, created_at'

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
