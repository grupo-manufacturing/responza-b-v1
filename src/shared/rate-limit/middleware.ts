import type { NextFunction, Request, Response } from 'express'

import { AppError } from '../errors/index.js'
import { buildCacheKey, CACHE_NAMESPACES } from '../redis/keys.js'
import { getClientIp } from './clientIp.js'
import { consumeRateLimit } from './limiter.js'

export type RateLimitMiddlewareOptions = {
  bucket: string
  limit: number
  windowSeconds: number
  keyGenerator?: (req: Request) => string
}

export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const clientKey = options.keyGenerator?.(req) ?? getClientIp(req)
    const key = buildCacheKey(CACHE_NAMESPACES.rateLimit, options.bucket, clientKey)
    const result = await consumeRateLimit({
      key,
      limit: options.limit,
      windowSeconds: options.windowSeconds,
    })

    if (!result.allowed) {
      if (result.retryAfterSeconds !== null) {
        res.setHeader('Retry-After', String(result.retryAfterSeconds))
      }

      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many requests. Please try again later.',
        ),
      )
      return
    }

    next()
  }
}
