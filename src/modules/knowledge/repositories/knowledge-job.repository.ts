import { getSupabaseAdminClient } from '../../../shared/database/index.js'
import { AppError } from '../../../shared/errors/index.js'
import type { KnowledgeJobRecord, KnowledgeJobStatus, KnowledgeJobType } from '../jobs/knowledge-job.types.js'

const COLUMNS =
  'id, organization_id, type, status, error, attempts, max_attempts, created_at, started_at, completed_at, updated_at'

function normalizeRecord(row: Record<string, unknown>): KnowledgeJobRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    type: row.type as KnowledgeJobType,
    status: row.status as KnowledgeJobStatus,
    error: (row.error as string | null) ?? null,
    attempts: row.attempts as number,
    max_attempts: row.max_attempts as number,
    created_at: row.created_at as string,
    started_at: (row.started_at as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    updated_at: row.updated_at as string,
  }
}

export async function createKnowledgeJob(input: {
  organizationId: string
  type: KnowledgeJobType
  maxAttempts: number
}): Promise<KnowledgeJobRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .insert({
      organization_id: input.organizationId,
      type: input.type,
      status: 'pending',
      max_attempts: input.maxAttempts,
    })
    .select(COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create knowledge job')
  }

  return normalizeRecord(data as Record<string, unknown>)
}

export async function findKnowledgeJobById(jobId: string): Promise<KnowledgeJobRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .select(COLUMNS)
    .eq('id', jobId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load knowledge job')
  }

  if (data === null) {
    return null
  }

  return normalizeRecord(data as Record<string, unknown>)
}

export async function findKnowledgeJobByOrganizationId(
  organizationId: string,
  jobId: string,
): Promise<KnowledgeJobRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .select(COLUMNS)
    .eq('id', jobId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load knowledge job')
  }

  if (data === null) {
    return null
  }

  return normalizeRecord(data as Record<string, unknown>)
}

export async function findActiveKnowledgeJob(
  organizationId: string,
  type: KnowledgeJobType,
): Promise<KnowledgeJobRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .select(COLUMNS)
    .eq('organization_id', organizationId)
    .eq('type', type)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to check active knowledge jobs')
  }

  if (data === null) {
    return null
  }

  return normalizeRecord(data as Record<string, unknown>)
}

export async function markKnowledgeJobRunning(jobId: string): Promise<KnowledgeJobRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const existing = await findKnowledgeJobById(jobId)

  if (existing === null) {
    throw new AppError(404, 'NOT_FOUND', 'Knowledge job not found')
  }

  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .update({
      status: 'running',
      attempts: existing.attempts + 1,
      started_at: now,
      updated_at: now,
    })
    .eq('id', jobId)
    .select(COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to mark knowledge job as running')
  }

  return normalizeRecord(data as Record<string, unknown>)
}

export async function markKnowledgeJobCompleted(jobId: string): Promise<KnowledgeJobRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .update({
      status: 'completed',
      error: null,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', jobId)
    .select(COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to mark knowledge job as completed')
  }

  return normalizeRecord(data as Record<string, unknown>)
}

export async function markKnowledgeJobFailed(
  jobId: string,
  errorMessage: string,
): Promise<KnowledgeJobRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .update({
      status: 'failed',
      error: errorMessage,
      completed_at: now,
      updated_at: now,
    })
    .eq('id', jobId)
    .select(COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to mark knowledge job as failed')
  }

  return normalizeRecord(data as Record<string, unknown>)
}

export async function resetKnowledgeJobForRetry(jobId: string): Promise<KnowledgeJobRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await client
    .from('organization_knowledge_jobs')
    .update({
      status: 'pending',
      error: null,
      started_at: null,
      completed_at: null,
      updated_at: now,
    })
    .eq('id', jobId)
    .select(COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to reset knowledge job for retry')
  }

  return normalizeRecord(data as Record<string, unknown>)
}
