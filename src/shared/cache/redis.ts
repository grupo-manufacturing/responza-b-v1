import { Redis, type RedisOptions } from 'ioredis'

import { loadEnv } from '../config/index.js'
import { getLogger } from '../logger/index.js'

let redisClient: Redis | null = null

function createRedisOptions(redisUrl: string): RedisOptions {
  const useTls =
    redisUrl.startsWith('rediss://') ||
    /(?:^|@)[^/]*upstash\.io/i.test(redisUrl)

  return {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    ...(useTls ? { tls: {} } : {}),
  }
}

export function getRedisClient(): Redis {
  if (redisClient !== null) {
    return redisClient
  }

  const env = loadEnv()
  redisClient = new Redis(env.REDIS_URL, createRedisOptions(env.REDIS_URL))

  redisClient.on('error', (error: Error) => {
    getLogger().error({ err: error }, 'Redis connection error')
  })

  return redisClient
}

export async function checkRedisConnection(): Promise<boolean> {
  const client = getRedisClient()

  try {
    if (client.status !== 'ready') {
      await client.connect()
    }

    const pong = await client.ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}

export async function closeRedisConnection(): Promise<void> {
  if (redisClient === null) {
    return
  }

  await redisClient.quit()
  redisClient = null
}
