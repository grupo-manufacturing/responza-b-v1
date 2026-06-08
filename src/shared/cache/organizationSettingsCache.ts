import { getRedisClient } from './redis.js'

const CACHE_KEY_PREFIX = 'org:settings:'

/**
 * Phase 1 scaffold for organization settings cache (Phase 2+ consumers).
 */
export async function getOrganizationSettingsCache(
  organizationId: string,
): Promise<Record<string, unknown> | null> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    const cached = await redis.get(`${CACHE_KEY_PREFIX}${organizationId}`)
    if (cached === null) {
      return null
    }

    return JSON.parse(cached) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function setOrganizationSettingsCache(
  organizationId: string,
  settings: Record<string, unknown>,
  ttlSeconds = 300,
): Promise<void> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    await redis.set(`${CACHE_KEY_PREFIX}${organizationId}`, JSON.stringify(settings), 'EX', ttlSeconds)
  } catch {
    // Cache is best-effort.
  }
}

export async function invalidateOrganizationSettingsCache(organizationId: string): Promise<void> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    await redis.del(`${CACHE_KEY_PREFIX}${organizationId}`)
  } catch {
    // Best-effort invalidation.
  }
}
