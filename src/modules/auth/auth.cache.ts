import { createHash } from 'node:crypto'

import type { AuthContext } from '../../shared/auth/index.js'
import { loadEnv } from '../../shared/config/index.js'
import { deleteCached, getCachedJson, setCachedJson } from '../../shared/redis/cache.js'
import { buildCacheKey, CACHE_NAMESPACES } from '../../shared/redis/keys.js'

function hashAccessToken(accessToken: string): string {
  return createHash('sha256').update(accessToken).digest('hex')
}

function buildAuthCacheKey(accessToken: string): string {
  return buildCacheKey(CACHE_NAMESPACES.auth, 'token', hashAccessToken(accessToken))
}

function getAuthCacheTtlSeconds(): number {
  return loadEnv().CACHE_AUTH_TTL_SECONDS
}

export async function getCachedAuthContext(accessToken: string): Promise<AuthContext | null> {
  return getCachedJson<AuthContext>(buildAuthCacheKey(accessToken))
}

export async function setCachedAuthContext(
  accessToken: string,
  auth: AuthContext,
): Promise<void> {
  await setCachedJson(buildAuthCacheKey(accessToken), auth, getAuthCacheTtlSeconds())
}

export async function invalidateAuthContextCache(accessToken: string): Promise<void> {
  await deleteCached(buildAuthCacheKey(accessToken))
}
