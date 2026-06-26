import { logger } from '../logger.js'
import { getRedisClient } from './client.js'

export async function getCachedJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedisClient().get(key)
    if (raw === null) {
      return null
    }

    return JSON.parse(raw) as T
  } catch (error) {
    logger.warn('Redis cache read failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  if (ttlSeconds <= 0) {
    return
  }

  try {
    await getRedisClient().set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (error) {
    logger.warn('Redis cache write failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    await getRedisClient().del(key)
  } catch (error) {
    logger.warn('Redis cache delete failed', {
      key,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function deleteCachedKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return
  }

  try {
    await getRedisClient().del(...keys)
  } catch (error) {
    logger.warn('Redis cache bulk delete failed', {
      keyCount: keys.length,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
