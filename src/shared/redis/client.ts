import { Redis, type RedisOptions } from 'ioredis'

import { loadEnv } from '../config/index.js'

function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl)

  return {
    host: url.hostname,
    port: url.port.length > 0 ? Number(url.port) : 6379,
    username: url.username.length > 0 ? url.username : undefined,
    password: url.password.length > 0 ? url.password : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null,
  }
}

export function getRedisConnectionOptions(): RedisOptions {
  return parseRedisUrl(loadEnv().REDIS_URL)
}

let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (redisClient !== null) {
    return redisClient
  }

  redisClient = new Redis(getRedisConnectionOptions())
  return redisClient
}

export async function checkRedisConnection(): Promise<boolean> {
  const client = getRedisClient()

  try {
    const response = await client.ping()
    return response === 'PONG'
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
