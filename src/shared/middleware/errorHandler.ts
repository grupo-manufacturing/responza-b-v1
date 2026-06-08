import type { NextFunction, Request, Response } from 'express'

import { isAppError } from '../errors/index.js'
import { getLogger } from '../logger/index.js'

type ErrorResponseBody = {
  error: {
    code: string
    message: string
    correlationId: string
    details?: unknown
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  const body: ErrorResponseBody = {
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
      correlationId: req.correlationId,
    },
  }

  res.status(404).json(body)
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(error)) {
    const body: ErrorResponseBody = {
      error: {
        code: error.code,
        message: error.message,
        correlationId: req.correlationId,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    }

    res.status(error.statusCode).json(body)
    return
  }

  getLogger().error({ err: error, correlationId: req.correlationId }, 'Unhandled error')

  const body: ErrorResponseBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId: req.correlationId,
    },
  }

  res.status(500).json(body)
}
