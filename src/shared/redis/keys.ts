export const CACHE_KEY_PREFIX = 'responza'

export const CACHE_NAMESPACES = {
  auth: 'auth',
  subscription: 'subscription',
  rateLimit: 'rate-limit',
} as const

export type CacheNamespace = (typeof CACHE_NAMESPACES)[keyof typeof CACHE_NAMESPACES]

export function buildCacheKey(namespace: CacheNamespace, ...parts: string[]): string {
  return [CACHE_KEY_PREFIX, namespace, ...parts].join(':')
}
