import { getRedisClient } from '../redis/client.js'

export type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number | null
}

export async function consumeRateLimit(input: {
  key: string
  limit: number
  windowSeconds: number
}): Promise<RateLimitResult> {
  try {
    const client = getRedisClient()
    const count = await client.incr(input.key)

    if (count === 1) {
      await client.expire(input.key, input.windowSeconds)
    }

    if (count > input.limit) {
      const ttl = await client.ttl(input.key)
      return {
        allowed: false,
        retryAfterSeconds: ttl > 0 ? ttl : input.windowSeconds,
      }
    }

    return { allowed: true, retryAfterSeconds: null }
  } catch {
    return { allowed: true, retryAfterSeconds: null }
  }
}
