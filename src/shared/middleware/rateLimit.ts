import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'

import { loadEnv } from '../config/index.js'

export function createRateLimitMiddleware() {
  const env = loadEnv()

  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'BAD_REQUEST',
        message: 'Too many requests. Please try again later.',
      },
    },
  })
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  createRateLimitMiddleware()(req, res, next)
}
