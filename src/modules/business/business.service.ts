import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import { enqueueKnowledgeIndexForOrganization, enqueueKnowledgeRemoveCatalogue } from '../knowledge/knowledge.enqueue.js'
import type { CompleteBusinessBody, UpdateBusinessBody } from './business.schemas.js'
import * as businessRepository from './business.repository.js'
import type { BusinessProfileRecord } from './business.repository.js'
import type { CatalogueFileRecord } from './business.types.js'
import { storeBusinessCatalogueFile } from './business.storage.js'
import { CATALOGUE_MAX_FILES } from './business.constants.js'

function toCatalogueFileResponse(file: CatalogueFileRecord) {
  return {
    id: file.id,
    filename: file.filename,
    mimeType: file.mimeType,
    fileSizeBytes: file.fileSizeBytes,
    createdAt: file.createdAt,
  }
}

function toBusinessResponse(profile: BusinessProfileRecord) {
  return {
    organizationId: profile.organization_id,
    brandName: profile.brand_name,
    websiteUrl: profile.website_url,
    facebookPageUrl: profile.facebook_page_url,
    instagramPageUrl: profile.instagram_page_url,
    businessDescription: profile.business_description,
    catalogueFiles: profile.catalogue_files.map(toCatalogueFileResponse),
    completed: profile.completed_at !== null,
    completedAt: profile.completed_at,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

function assertOrganizationAccess(auth: AuthContext, organizationId: string): void {
  if (auth.organizationId !== organizationId) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot access business profile for another organization')
  }
}

function bodyToProfilePatch(
  input: CompleteBusinessBody | UpdateBusinessBody,
): businessRepository.BusinessProfileUpdatePatch {
  return {
    brand_name: input.brandName,
    website_url: input.websiteUrl,
    facebook_page_url: input.facebookPageUrl,
    instagram_page_url: input.instagramPageUrl,
    business_description: input.businessDescription,
  }
}

export async function getBusiness(auth: AuthContext) {
  const profile = await businessRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  assertOrganizationAccess(auth, profile.organization_id)
  return toBusinessResponse(profile)
}

export async function completeBusiness(auth: AuthContext, input: CompleteBusinessBody) {
  const profile = await businessRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  if (profile.completed_at !== null) {
    return toBusinessResponse(profile)
  }

  const completed = await businessRepository.completeProfile(
    auth.organizationId,
    bodyToProfilePatch(input),
  )
  await enqueueKnowledgeIndexForOrganization(auth.organizationId)
  return toBusinessResponse(completed)
}

export async function updateBusiness(auth: AuthContext, input: UpdateBusinessBody) {
  const profile = await businessRepository.findProfileByOrganizationId(auth.organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  const updated = await businessRepository.updateProfile(
    auth.organizationId,
    bodyToProfilePatch(input),
  )
  await enqueueKnowledgeIndexForOrganization(auth.organizationId)
  return toBusinessResponse(updated)
}

export async function uploadCatalogueFile(
  auth: AuthContext,
  file:
    | {
        buffer: Buffer
        mimetype: string
        originalname: string
      }
    | undefined,
) {
  if (file === undefined || file.buffer.byteLength === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Please choose a file to upload.')
  }

  // Check the file limit before uploading to storage so a rejected upload
  // never leaves an orphaned object behind.
  const existingProfile = await businessRepository.findProfileByOrganizationId(auth.organizationId)
  if (existingProfile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  if (existingProfile.catalogue_files.length >= CATALOGUE_MAX_FILES) {
    throw new AppError(
      400,
      'BAD_REQUEST',
      `You have reached the limit of ${CATALOGUE_MAX_FILES} catalogue files. Remove one to upload another.`,
    )
  }

  const stored = await storeBusinessCatalogueFile({
    organizationId: auth.organizationId,
    buffer: file.buffer,
    mimeTypeHint: file.mimetype,
    filename: file.originalname,
  })

  const catalogueFile: CatalogueFileRecord = {
    id: stored.id,
    storagePath: stored.storagePath,
    filename: stored.filename,
    mimeType: stored.mimeType,
    fileSizeBytes: stored.fileSizeBytes,
    createdAt: new Date().toISOString(),
  }

  const profile = await businessRepository.addCatalogueFile(auth.organizationId, catalogueFile)
  await enqueueKnowledgeIndexForOrganization(auth.organizationId, {
    catalogueFileId: catalogueFile.id,
  })

  return {
    file: toCatalogueFileResponse(catalogueFile),
    profile: toBusinessResponse(profile),
  }
}

export async function deleteCatalogueFile(auth: AuthContext, fileId: string) {
  const { profile, storagePath } = await businessRepository.removeCatalogueFile(
    auth.organizationId,
    fileId,
  )

  if (storagePath !== null) {
    try {
      await businessRepository.deleteCatalogueStorageObject(storagePath)
    } catch {
      // Profile metadata is already updated; orphaned storage can be cleaned later.
    }
  }

  await enqueueKnowledgeRemoveCatalogue(auth.organizationId, fileId)

  return toBusinessResponse(profile)
}
