import type { NextFunction, Request, Response } from 'express'

import { isAppError } from '../errors/index.js'

type ErrorResponseBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  const body: ErrorResponseBody = {
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  }

  res.status(404).json(body)
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (isAppError(error)) {
    const body: ErrorResponseBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
    }

    res.status(error.statusCode).json(body)
    return
  }

  console.error(error)

  const body: ErrorResponseBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }

  res.status(500).json(body)
}
