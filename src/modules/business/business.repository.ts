import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { getMessageMediaBucketName } from '../../shared/storage/supabase.storage.js'
import { AppError } from '../../shared/errors/index.js'
import { CATALOGUE_MAX_FILES } from './business.constants.js'
import type { CatalogueFileRecord } from './business.types.js'

export type BusinessProfileRecord = {
  id: string
  organization_id: string
  brand_name: string | null
  website_url: string | null
  facebook_page_url: string | null
  instagram_page_url: string | null
  business_description: string | null
  catalogue_files: CatalogueFileRecord[]
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type BusinessProfileUpdatePatch = {
  brand_name?: string
  website_url?: string | null
  facebook_page_url?: string | null
  instagram_page_url?: string | null
  business_description?: string
}

const PROFILE_COLUMNS =
  'id, organization_id, brand_name, website_url, facebook_page_url, instagram_page_url, business_description, catalogue_files, completed_at, created_at, updated_at'

function normalizeCatalogueFiles(value: unknown): CatalogueFileRecord[] {
  if (!Array.isArray(value)) {
    return []
  }

  const files: CatalogueFileRecord[] = []

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue
    }

    const row = item as Record<string, unknown>
    const id = row.id
    const storagePath = row.storagePath ?? row.storage_path
    const filename = row.filename
    const mimeType = row.mimeType ?? row.mime_type
    const fileSizeBytes = row.fileSizeBytes ?? row.file_size_bytes
    const createdAt = row.createdAt ?? row.created_at

    if (
      typeof id !== 'string' ||
      typeof storagePath !== 'string' ||
      typeof filename !== 'string' ||
      typeof mimeType !== 'string' ||
      typeof fileSizeBytes !== 'number' ||
      typeof createdAt !== 'string'
    ) {
      continue
    }

    files.push({
      id,
      storagePath,
      filename,
      mimeType,
      fileSizeBytes,
      createdAt,
    })
  }

  return files
}

function normalizeProfileRecord(row: Record<string, unknown>): BusinessProfileRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    brand_name: (row.brand_name as string | null) ?? null,
    website_url: (row.website_url as string | null) ?? null,
    facebook_page_url: (row.facebook_page_url as string | null) ?? null,
    instagram_page_url: (row.instagram_page_url as string | null) ?? null,
    business_description: (row.business_description as string | null) ?? null,
    catalogue_files: normalizeCatalogueFiles(row.catalogue_files),
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function findProfileByOrganizationId(
  organizationId: string,
): Promise<BusinessProfileRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('organization_business_profiles')
    .select(PROFILE_COLUMNS)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load business profile')
  }

  if (data === null) {
    return null
  }

  return normalizeProfileRecord(data as Record<string, unknown>)
}

export async function completeProfile(
  organizationId: string,
  patch: BusinessProfileUpdatePatch,
): Promise<BusinessProfileRecord> {
  const client = getSupabaseAdminClient()
  const completedAt = new Date().toISOString()
  const { data, error } = await client
    .from('organization_business_profiles')
    .update({
      ...patch,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('organization_id', organizationId)
    .select(PROFILE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to complete business profile')
  }

  return normalizeProfileRecord(data as Record<string, unknown>)
}

export async function addCatalogueFile(
  organizationId: string,
  file: CatalogueFileRecord,
): Promise<BusinessProfileRecord> {
  const profile = await findProfileByOrganizationId(organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  if (profile.catalogue_files.length >= CATALOGUE_MAX_FILES) {
    throw new AppError(400, 'BAD_REQUEST', `You can upload up to ${CATALOGUE_MAX_FILES} catalogue files`)
  }

  const nextFiles = [...profile.catalogue_files, file]
  const client = getSupabaseAdminClient()
  const updatedAt = new Date().toISOString()
  const { data, error } = await client
    .from('organization_business_profiles')
    .update({
      catalogue_files: nextFiles,
      updated_at: updatedAt,
    })
    .eq('organization_id', organizationId)
    .select(PROFILE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to save catalogue file')
  }

  return normalizeProfileRecord(data as Record<string, unknown>)
}

export async function removeCatalogueFile(
  organizationId: string,
  fileId: string,
): Promise<{ profile: BusinessProfileRecord; storagePath: string | null }> {
  const profile = await findProfileByOrganizationId(organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  const target = profile.catalogue_files.find((file) => file.id === fileId)
  const nextFiles = profile.catalogue_files.filter((file) => file.id !== fileId)

  if (target === undefined) {
    throw new AppError(404, 'NOT_FOUND', 'Catalogue file not found')
  }

  const client = getSupabaseAdminClient()
  const updatedAt = new Date().toISOString()
  const { data, error } = await client
    .from('organization_business_profiles')
    .update({
      catalogue_files: nextFiles,
      updated_at: updatedAt,
    })
    .eq('organization_id', organizationId)
    .select(PROFILE_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to remove catalogue file')
  }

  return {
    profile: normalizeProfileRecord(data as Record<string, unknown>),
    storagePath: target.storagePath,
  }
}

export async function deleteCatalogueStorageObject(storagePath: string): Promise<void> {
  const client = getSupabaseAdminClient()
  const bucket = getMessageMediaBucketName()
  const { error } = await client.storage.from(bucket).remove([storagePath])

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete catalogue file')
  }
}
