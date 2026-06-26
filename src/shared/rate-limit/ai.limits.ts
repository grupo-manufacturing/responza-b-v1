import type { Request } from 'express'

import { loadEnv } from '../config/index.js'
import { getClientIp } from './clientIp.js'
import { createRateLimitMiddleware } from './middleware.js'

function organizationOrIpKey(req: Request): string {
  return req.auth?.organizationId ?? getClientIp(req)
}

export function createAiRateLimiter() {
  const env = loadEnv()

  return createRateLimitMiddleware({
    bucket: 'ai',
    limit: env.RATE_LIMIT_AI_MAX,
    windowSeconds: env.RATE_LIMIT_AI_WINDOW_SECONDS,
    keyGenerator: organizationOrIpKey,
  })
}
