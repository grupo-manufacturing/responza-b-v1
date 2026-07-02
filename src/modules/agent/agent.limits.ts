import { loadEnv } from '../../shared/config/index.js'
import { getRedisClient } from '../../shared/redis/client.js'
import { buildCacheKey, CACHE_NAMESPACES } from '../../shared/redis/keys.js'
import * as agentRepository from './agent.repository.js'

export function formatAgentUsageDate(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function agentDailyReplyLimit(): number {
  return loadEnv().AGENT_DAILY_REPLY_LIMIT
}

function dailyUsageKey(organizationId: string, usageDate: string): string {
  return buildCacheKey(CACHE_NAMESPACES.agentDaily, organizationId, usageDate)
}

function secondsUntilUtcMidnight(date = new Date()): number {
  const midnightUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
  return Math.max(1, Math.floor((midnightUtc - date.getTime()) / 1000))
}

async function readCountFromRedis(key: string): Promise<number | null> {
  try {
    const raw = await getRedisClient().get(key)
    if (raw === null) {
      return null
    }

    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

async function writeCountToRedis(key: string, count: number, ttlSeconds: number): Promise<void> {
  try {
    await getRedisClient().set(key, String(count), 'EX', ttlSeconds)
  } catch {
    // Redis is an acceleration layer; DB remains durable.
  }
}

async function getAgentRepliesUsedTodayFromDatabase(
  organizationId: string,
  usageDate: string,
): Promise<number> {
  return agentRepository.getAgentReplyCountForDate(organizationId, usageDate)
}

export async function getAgentRepliesUsedToday(organizationId: string): Promise<number> {
  const usageDate = formatAgentUsageDate()
  const key = dailyUsageKey(organizationId, usageDate)
  const cached = await readCountFromRedis(key)

  if (cached !== null) {
    return cached
  }

  const dbCount = await getAgentRepliesUsedTodayFromDatabase(organizationId, usageDate)
  await writeCountToRedis(key, dbCount, secondsUntilUtcMidnight())

  return dbCount
}

export async function canAgentReplyToday(organizationId: string): Promise<boolean> {
  const used = await getAgentRepliesUsedToday(organizationId)
  return used < agentDailyReplyLimit()
}

export async function reserveAgentReplySlot(organizationId: string): Promise<boolean> {
  const usageDate = formatAgentUsageDate()
  const limit = agentDailyReplyLimit()
  const key = dailyUsageKey(organizationId, usageDate)
  const ttlSeconds = secondsUntilUtcMidnight()

  try {
    const client = getRedisClient()
    const count = await client.incr(key)

    if (count === 1) {
      await client.expire(key, ttlSeconds)
    }

    if (count > limit) {
      await client.decr(key)
      return false
    }

    await agentRepository.setAgentReplyCount(organizationId, usageDate, count)
    return true
  } catch {
    const used = await getAgentRepliesUsedTodayFromDatabase(organizationId, usageDate)
    if (used >= limit) {
      return false
    }

    const nextCount = used + 1
    await agentRepository.setAgentReplyCount(organizationId, usageDate, nextCount)
    await writeCountToRedis(key, nextCount, ttlSeconds)
    return true
  }
}

export async function releaseAgentReplySlot(organizationId: string): Promise<void> {
  const usageDate = formatAgentUsageDate()
  const key = dailyUsageKey(organizationId, usageDate)
  const ttlSeconds = secondsUntilUtcMidnight()

  try {
    const client = getRedisClient()
    const count = await client.decr(key)
    const nextCount = Math.max(0, count)

    if (count < 0) {
      await client.set(key, '0', 'EX', ttlSeconds)
    }

    await agentRepository.setAgentReplyCount(organizationId, usageDate, nextCount)
    return
  } catch {
    const used = await getAgentRepliesUsedTodayFromDatabase(organizationId, usageDate)
    const nextCount = Math.max(0, used - 1)
    await agentRepository.setAgentReplyCount(organizationId, usageDate, nextCount)
    await writeCountToRedis(key, nextCount, ttlSeconds)
  }
}
