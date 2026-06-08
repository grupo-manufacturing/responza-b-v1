import { getRedisClient } from '../cache/index.js'
import { loadEnv } from '../config/index.js'
import type { AuthContext } from './types.js'

const CACHE_KEY_PREFIX = 'auth:context:'

export async function getCachedAuthContext(organizationId: string): Promise<AuthContext | null> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    const cached = await redis.get(`${CACHE_KEY_PREFIX}${organizationId}`)
    if (cached === null) {
      return null
    }

    return JSON.parse(cached) as AuthContext
  } catch {
    return null
  }
}

export async function setCachedAuthContext(context: AuthContext): Promise<void> {
  const env = loadEnv()
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    await redis.set(
      `${CACHE_KEY_PREFIX}${context.organizationId}`,
      JSON.stringify(context),
      'EX',
      env.AUTH_CONTEXT_CACHE_TTL_SECONDS,
    )
  } catch {
    // Cache is best-effort — login must succeed without Redis.
  }
}

export async function invalidateAuthContextCache(organizationId: string): Promise<void> {
  const redis = getRedisClient()

  try {
    if (redis.status !== 'ready') {
      await redis.connect()
    }

    await redis.del(`${CACHE_KEY_PREFIX}${organizationId}`)
  } catch {
    // Cache invalidation is best-effort.
  }
}
