import { loadEnv } from '../../shared/config/index.js'
import { getRedisClient } from '../../shared/cache/redis.js'
import type { IntegrationPlatform, IntegrationStatus } from './integrations.constants.js'
import type { IntegrationPublicMetadata } from './integrations.types.js'

const CACHE_KEY_PREFIX = 'org:integrations:'

export type CachedIntegrationSummary = {
  platform: IntegrationPlatform
  status: IntegrationStatus
  connectedAt: string | null
  disconnectedAt: string | null
  updatedAt: string | null
  metadata?: IntegrationPublicMetadata
}

function cacheKey(organizationId: string): string {
  return `${CACHE_KEY_PREFIX}${organizationId}`
}

function getCacheTtlSeconds(): number {
  return loadEnv().INTEGRATIONS_LIST_CACHE_TTL_SECONDS
}

export async function getIntegrationsListCache(
  organizationId: string,
): Promise<CachedIntegrationSummary[] | null> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    const cached = await redis.get(cacheKey(organizationId))
    if (cached === null) {
      return null
    }

    return JSON.parse(cached) as CachedIntegrationSummary[]
  } catch {
    return null
  }
}

export async function setIntegrationsListCache(
  organizationId: string,
  integrations: CachedIntegrationSummary[],
): Promise<void> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    await redis.set(
      cacheKey(organizationId),
      JSON.stringify(integrations),
      'EX',
      getCacheTtlSeconds(),
    )
  } catch {
    // Cache is best-effort.
  }
}

export async function invalidateIntegrationsListCache(organizationId: string): Promise<void> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    await redis.del(cacheKey(organizationId))
  } catch {
    // Best-effort invalidation.
  }
}
