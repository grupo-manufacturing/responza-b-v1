import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import { getRedisClient } from '../../shared/redis/client.js'
import { buildCacheKey, CACHE_NAMESPACES } from '../../shared/redis/keys.js'
import { buildBusinessContextLines } from './business.context.js'
import type { BusinessProfileRecord } from './business.repository.js'
import { fetchPublicUrlExcerpt } from './business.url-fetch.js'

type UrlSource = {
  label: string
  url: string | null
}

function urlContextCacheKey(organizationId: string, profileUpdatedAt: string): string {
  return buildCacheKey(CACHE_NAMESPACES.businessUrlContext, organizationId, profileUpdatedAt)
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

async function fetchUrlSourceLines(source: UrlSource, maxCharsPerUrl: number): Promise<string[]> {
  if (source.url === null || source.url.trim().length === 0) {
    return []
  }

  const fetched = await fetchPublicUrlExcerpt(source.url, maxCharsPerUrl)
  if (fetched === null) {
    return [
      `${source.label} (${source.url}): Could not fetch readable content from this page. Do not assume details from this URL.`,
    ]
  }

  const titleLine =
    fetched.title !== null && fetched.title.length > 0 ? `Title: ${fetched.title}` : null

  return [
    `${source.label} (${fetched.url}):`,
    ...(titleLine !== null ? [titleLine] : []),
    fetched.excerpt,
  ]
}

async function buildFetchedUrlContextLines(profile: BusinessProfileRecord): Promise<string[]> {
  const env = loadEnv()
  if (!env.BUSINESS_URL_FETCH_ENABLED) {
    return []
  }

  const sources: UrlSource[] = [
    { label: 'Website content', url: profile.website_url },
    { label: 'Facebook page content', url: profile.facebook_page_url },
    { label: 'Instagram page content', url: profile.instagram_page_url },
  ].filter((source) => source.url !== null && source.url.trim().length > 0)

  if (sources.length === 0) {
    return []
  }

  const results = await Promise.all(
    sources.map((source) => fetchUrlSourceLines(source, env.BUSINESS_URL_CONTEXT_MAX_CHARS_PER_URL)),
  )

  const lines: string[] = []
  for (const sourceLines of results) {
    if (sourceLines.length > 0) {
      if (lines.length > 0) {
        lines.push('')
      }
      lines.push(...sourceLines)
    }
  }

  return lines
}

export async function buildAgentBusinessContextLines(
  organizationId: string,
  profile: BusinessProfileRecord,
): Promise<string[]> {
  const baseLines = buildBusinessContextLines(profile)
  const cacheKey = urlContextCacheKey(organizationId, profile.updated_at)

  const cachedUrlLines = await readCachedUrlContextLines(cacheKey)
  if (cachedUrlLines !== null) {
    return mergeBusinessContextLines(baseLines, cachedUrlLines)
  }

  let fetchedUrlLines: string[] = []
  try {
    fetchedUrlLines = await buildFetchedUrlContextLines(profile)
    await writeCachedUrlContextLines(cacheKey, fetchedUrlLines)
  } catch (error: unknown) {
    logger.warn('[business] Failed to fetch URL context for agent', {
      organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return mergeBusinessContextLines(baseLines, fetchedUrlLines)
}

function mergeBusinessContextLines(baseLines: string[], fetchedUrlLines: string[]): string[] {
  if (fetchedUrlLines.length === 0) {
    return baseLines
  }

  return [...baseLines, '', 'Fetched page content (use together with profile fields above):', ...fetchedUrlLines]
}
