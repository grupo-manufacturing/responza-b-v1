import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

import { loadEnv } from '../config/env.js'
import { AppError } from '../errors/index.js'

const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12

export type AdminSession = {
  readonly username: string
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

export function areAdminCredentialsConfigured(): boolean {
  const env = loadEnv()
  return env.ADMIN_USERNAME.trim().length > 0 && env.ADMIN_PASSWORD.length > 0
}

function getAdminSessionSecret(): string {
  const env = loadEnv()
  const configured = env.ADMIN_SESSION_SECRET.trim()
  if (configured.length > 0) {
    return configured
  }

  return createHash('sha256')
    .update(`responza-admin:${env.ADMIN_USERNAME}:${env.ADMIN_PASSWORD}`)
    .digest('hex')
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  if (!areAdminCredentialsConfigured()) {
    return false
  }

  const env = loadEnv()
  return safeEqual(username.trim(), env.ADMIN_USERNAME.trim()) && safeEqual(password, env.ADMIN_PASSWORD)
}

export function issueAdminToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'admin',
      username,
      exp: Math.floor(Date.now() / 1000) + ADMIN_TOKEN_TTL_SECONDS,
    }),
  ).toString('base64url')

  const signature = createHmac('sha256', getAdminSessionSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function verifyAdminToken(token: string): AdminSession {
  const [payload, signature] = token.split('.')
  if (payload === undefined || signature === undefined || payload.length === 0 || signature.length === 0) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid admin session')
  }

  const expected = createHmac('sha256', getAdminSessionSecret()).update(payload).digest('base64url')
  if (!safeEqual(signature, expected)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid admin session')
  }

  let parsed: { sub?: string; username?: string; exp?: number }
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: string
      username?: string
      exp?: number
    }
  } catch {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid admin session')
  }

  if (parsed.sub !== 'admin' || typeof parsed.username !== 'string' || typeof parsed.exp !== 'number') {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid admin session')
  }

  if (parsed.exp <= Math.floor(Date.now() / 1000)) {
    throw new AppError(401, 'UNAUTHORIZED', 'Admin session expired')
  }

  return { username: parsed.username }
}
