import type { NextFunction, Request, Response } from 'express'

import { loadEnv } from '../config/index.js'
import { isHealthCheckPath } from '../shutdown.js'

export function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (isHealthCheckPath(req.path)) {
    next()
    return
  }

  const timeoutMs = loadEnv().HTTP_REQUEST_TIMEOUT_MS

  res.setTimeout(timeoutMs, () => {
    if (res.headersSent) {
      return
    }

    res.status(408).json({
      error: {
        code: 'REQUEST_TIMEOUT',
        message: 'Request timed out',
      },
    })
  })

  next()
}
