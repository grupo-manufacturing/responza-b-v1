import type { Request } from 'express'

import { loadEnv } from '../config/index.js'
import { getClientIp } from './clientIp.js'
import { createRateLimitMiddleware } from './middleware.js'

function normalizedEmailFromBody(req: Request): string | null {
  const email = req.body?.email
  if (typeof email !== 'string') {
    return null
  }

  const normalized = email.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function emailOrIpKey(req: Request): string {
  return normalizedEmailFromBody(req) ?? getClientIp(req)
}

export function createAuthRateLimiters() {
  const env = loadEnv()

  return {
    login: createRateLimitMiddleware({
      bucket: 'auth-login',
      limit: env.RATE_LIMIT_AUTH_LOGIN_MAX,
      windowSeconds: env.RATE_LIMIT_AUTH_LOGIN_WINDOW_SECONDS,
      keyGenerator: getClientIp,
    }),
    register: createRateLimitMiddleware({
      bucket: 'auth-register',
      limit: env.RATE_LIMIT_AUTH_REGISTER_MAX,
      windowSeconds: env.RATE_LIMIT_AUTH_REGISTER_WINDOW_SECONDS,
      keyGenerator: getClientIp,
    }),
    verifyOtp: createRateLimitMiddleware({
      bucket: 'auth-verify-otp',
      limit: env.RATE_LIMIT_AUTH_OTP_MAX,
      windowSeconds: env.RATE_LIMIT_AUTH_OTP_WINDOW_SECONDS,
      keyGenerator: emailOrIpKey,
    }),
    resendOtp: createRateLimitMiddleware({
      bucket: 'auth-resend-otp',
      limit: env.RATE_LIMIT_AUTH_OTP_MAX,
      windowSeconds: env.RATE_LIMIT_AUTH_OTP_WINDOW_SECONDS,
      keyGenerator: emailOrIpKey,
    }),
    refresh: createRateLimitMiddleware({
      bucket: 'auth-refresh',
      limit: env.RATE_LIMIT_AUTH_LOGIN_MAX,
      windowSeconds: env.RATE_LIMIT_AUTH_LOGIN_WINDOW_SECONDS,
      keyGenerator: getClientIp,
    }),
  }
}
