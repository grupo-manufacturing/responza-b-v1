import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { IngestedSourceInsert, IngestedSourceRecord } from '../jobs/knowledge-job.types.js'

const COLUMNS = 'id, organization_id, source_type, source_ref, content, created_at'

function normalizeRecord(row: Record<string, unknown>): IngestedSourceRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    source_type: row.source_type as string,
    source_ref: (row.source_ref as string | null) ?? null,
    content: row.content as string,
    created_at: row.created_at as string,
  }
}

export async function deleteIngestedSourcesByOrganizationId(organizationId: string): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('organization_ingested_sources')
    .delete()
    .eq('organization_id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to clear ingested sources')
  }
}

export async function insertIngestedSources(
  organizationId: string,
  sources: IngestedSourceInsert[],
): Promise<IngestedSourceRecord[]> {
  if (sources.length === 0) {
    return []
  }

  const client = getSupabaseAdminClient()
  const rows = sources.map((source) => ({
    organization_id: organizationId,
    source_type: source.source_type,
    source_ref: source.source_ref,
    content: source.content,
  }))

  const { data, error } = await client
    .from('organization_ingested_sources')
    .insert(rows)
    .select(COLUMNS)

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to save ingested sources')
  }

  return data.map((row) => normalizeRecord(row as Record<string, unknown>))
}

export async function findIngestedSourcesByOrganizationId(
  organizationId: string,
): Promise<IngestedSourceRecord[]> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_ingested_sources')
    .select(COLUMNS)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load ingested sources')
  }

  return (data ?? []).map((row) => normalizeRecord(row as Record<string, unknown>))
}

export async function countIngestedSourcesByOrganizationId(organizationId: string): Promise<number> {
  const client = getSupabaseAdminClient()
  const { count, error } = await client
    .from('organization_ingested_sources')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to count ingested sources')
  }

  return count ?? 0
}
