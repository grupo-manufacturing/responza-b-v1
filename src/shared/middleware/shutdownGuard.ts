import type { NextFunction, Request, Response } from 'express'

import { isHealthCheckPath, isShuttingDown } from '../shutdown.js'

export function shutdownGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!isShuttingDown() || isHealthCheckPath(req.path)) {
    next()
    return
  }

  res.status(503).json({
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Server is shutting down',
    },
  })
}
