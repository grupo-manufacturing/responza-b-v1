import { findProfileByOrganizationId } from '../../business/business.repository.js'
import { AppError } from '../../../shared/errors/index.js'
import { resolveCatalogueFileType } from '../knowledge.constants.js'
import type { IngestedSourceInsert } from '../jobs/knowledge-job.types.js'
import { crawlInstagram } from './instagram-crawler.js'
import { parseCatalogueFile } from './file-parser.js'
import { cleanText } from './text-cleaner.js'
import { crawlWebsite } from './website-crawler.js'

export type IngestionResult = {
  sources: IngestedSourceInsert[]
  errors: string[]
}

export async function ingestBusinessData(organizationId: string): Promise<IngestionResult> {
  const profile = await findProfileByOrganizationId(organizationId)
  if (profile === null) {
    throw new AppError(404, 'NOT_FOUND', 'Business profile not found')
  }

  const result: IngestionResult = {
    sources: [],
    errors: [],
  }

  if (profile.brand_name !== null && profile.brand_name.trim().length > 0) {
    const content = cleanText(profile.brand_name)
    if (content.length > 0) {
      result.sources.push({
        source_type: 'brand_name',
        source_ref: 'brand_name',
        content,
      })
    }
  }

  if (profile.business_description !== null && profile.business_description.trim().length > 0) {
    const content = cleanText(profile.business_description)
    if (content.length > 0) {
      result.sources.push({
        source_type: 'description',
        source_ref: 'business_description',
        content,
      })
    }
  }

  if (profile.website_url !== null && profile.website_url.trim().length > 0) {
    try {
      const content = await crawlWebsite(profile.website_url)
      if (content.length > 0) {
        result.sources.push({
          source_type: 'website',
          source_ref: profile.website_url,
          content,
        })
      }
    } catch (error) {
      result.errors.push(`Website crawl failed: ${formatError(error)}`)
    }
  }

  if (profile.instagram_page_url !== null && profile.instagram_page_url.trim().length > 0) {
    try {
      const content = await crawlInstagram(profile.instagram_page_url)
      if (content.length > 0) {
        result.sources.push({
          source_type: 'instagram',
          source_ref: profile.instagram_page_url,
          content,
        })
      }
    } catch (error) {
      result.errors.push(`Instagram crawl failed: ${formatError(error)}`)
    }
  }

  for (const catalogueFile of profile.catalogue_files) {
    const fileType = resolveCatalogueFileType(catalogueFile.mimeType)
    if (fileType === null) {
      result.errors.push(`File parsing failed for ${catalogueFile.filename}: Unsupported file type: ${catalogueFile.mimeType}`)
      continue
    }

    try {
      const content = await parseCatalogueFile(catalogueFile.storagePath, fileType)
      if (content.length > 0) {
        result.sources.push({
          source_type: fileType,
          source_ref: catalogueFile.filename,
          content,
        })
      }
    } catch (error) {
      result.errors.push(`File parsing failed for ${catalogueFile.filename}: ${formatError(error)}`)
    }
  }

  if (result.sources.length === 0 && result.errors.length === 0) {
    result.errors.push('No data available to ingest for this business.')
  }

  return result
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
