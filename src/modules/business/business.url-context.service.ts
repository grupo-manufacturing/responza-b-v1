import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import { getRedisClient } from '../../shared/redis/client.js'
import { buildCacheKey, CACHE_NAMESPACES } from '../../shared/redis/keys.js'
import { buildBusinessContextLines } from './business.context.js'
import { buildCatalogueContextLines } from './catalogue/catalogue.context.service.js'
import type { BusinessProfileRecord } from './business.repository.js'
import {
  fetchPublicUrlExcerpt,
  fetchWebsiteWithRelevantSubpages,
  type FetchedUrlExcerpt,
} from './business.url-fetch.js'

type UrlSource = {
  label: string
  url: string | null
}

function urlContextCacheKey(organizationId: string, profileUpdatedAt: string): string {
  return buildCacheKey(CACHE_NAMESPACES.businessUrlContext, 'v2', organizationId, profileUpdatedAt)
}

async function readCachedUrlContextLines(key: string): Promise<string[] | null> {
  try {
    const raw = await getRedisClient().get(key)
    if (raw === null) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed) || !parsed.every((line) => typeof line === 'string')) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

async function writeCachedUrlContextLines(key: string, lines: string[]): Promise<void> {
  const env = loadEnv()
  try {
    await getRedisClient().set(key, JSON.stringify(lines), 'EX', env.BUSINESS_URL_CONTEXT_CACHE_TTL_SECONDS)
  } catch {
    // Cache is optional; live fetch still succeeded.
  }
}

function formatFetchedExcerptLines(sourceLabel: string, fetched: FetchedUrlExcerpt): string[] {
  const pageName = fetched.pageLabel === 'home' ? 'home' : fetched.pageLabel
  const titleLine =
    fetched.title !== null && fetched.title.length > 0 ? `Title: ${fetched.title}` : null

  return [
    `${sourceLabel} (${pageName}) (${fetched.url}):`,
    ...(titleLine !== null ? [titleLine] : []),
    fetched.excerpt,
  ]
}

async function fetchWebsiteSourceLines(
  websiteUrl: string,
  maxCharsPerPage: number,
  maxSubpages: number,
): Promise<string[]> {
  const pages = await fetchWebsiteWithRelevantSubpages(websiteUrl, maxCharsPerPage, maxSubpages)
  if (pages.length === 0) {
    return [
      `Website content (${websiteUrl}): Could not fetch readable content from this site. Do not assume details from this URL.`,
    ]
  }

  const lines: string[] = []
  for (const page of pages) {
    if (lines.length > 0) {
      lines.push('')
    }
    lines.push(...formatFetchedExcerptLines('Website content', page))
  }

  return lines
}

async function fetchSingleUrlSourceLines(
  source: UrlSource,
  maxCharsPerUrl: number,
): Promise<string[]> {
  if (source.url === null || source.url.trim().length === 0) {
    return []
  }

  const fetched = await fetchPublicUrlExcerpt(source.url, maxCharsPerUrl)
  if (fetched === null) {
    return [
      `${source.label} (${source.url}): Could not fetch readable content from this page. Do not assume details from this URL.`,
    ]
  }

  return formatFetchedExcerptLines(source.label, fetched)
}

async function buildFetchedUrlContextLines(profile: BusinessProfileRecord): Promise<string[]> {
  const env = loadEnv()
  if (!env.BUSINESS_URL_FETCH_ENABLED) {
    return []
  }

  const lines: string[] = []

  if (profile.website_url !== null && profile.website_url.trim().length > 0) {
    const websiteLines = await fetchWebsiteSourceLines(
      profile.website_url,
      env.BUSINESS_URL_CONTEXT_MAX_CHARS_PER_URL,
      env.BUSINESS_URL_MAX_SUBPAGES,
    )
    if (websiteLines.length > 0) {
      lines.push(...websiteLines)
    }
  }

  const socialSources: UrlSource[] = [
    { label: 'Facebook page content', url: profile.facebook_page_url },
    { label: 'Instagram page content', url: profile.instagram_page_url },
  ].filter((source) => source.url !== null && source.url.trim().length > 0)

  if (socialSources.length > 0) {
    const socialResults = await Promise.all(
      socialSources.map((source) =>
        fetchSingleUrlSourceLines(source, env.BUSINESS_URL_CONTEXT_MAX_CHARS_PER_URL),
      ),
    )

    for (const sourceLines of socialResults) {
      if (sourceLines.length > 0) {
        if (lines.length > 0) {
          lines.push('')
        }
        lines.push(...sourceLines)
      }
    }
  }

  return lines
}

export async function buildAgentBusinessContextLines(
  organizationId: string,
  profile: BusinessProfileRecord,
  options?: { customerMessage?: string },
): Promise<string[]> {
  const baseLines = buildBusinessContextLines(profile)
  const cacheKey = urlContextCacheKey(organizationId, profile.updated_at)

  let fetchedUrlLines: string[] = []
  const cachedUrlLines = await readCachedUrlContextLines(cacheKey)
  if (cachedUrlLines !== null) {
    fetchedUrlLines = cachedUrlLines
  } else {
    try {
      fetchedUrlLines = await buildFetchedUrlContextLines(profile)
      await writeCachedUrlContextLines(cacheKey, fetchedUrlLines)
    } catch (error: unknown) {
      logger.warn('[business] Failed to fetch URL context for agent', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  let catalogueLines: string[] = []
  try {
    catalogueLines = await buildCatalogueContextLines(
      organizationId,
      profile,
      options?.customerMessage,
    )
  } catch (error: unknown) {
    logger.warn('[business] Failed to build catalogue context for agent', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return mergeBusinessContextLines(baseLines, fetchedUrlLines, catalogueLines)
}

function mergeBusinessContextLines(
  baseLines: string[],
  fetchedUrlLines: string[],
  catalogueLines: string[],
): string[] {
  const merged = [...baseLines]

  if (fetchedUrlLines.length > 0) {
    merged.push('', 'Fetched page content (use together with profile fields above):', ...fetchedUrlLines)
  }

  if (catalogueLines.length > 0) {
    merged.push('', ...catalogueLines)
  }

  return merged
}
