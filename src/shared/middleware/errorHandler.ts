import type { NextFunction, Request, Response } from 'express'
import multer from 'multer'

import { isAppError } from '../errors/index.js'
import { logger } from '../logger.js'

type ErrorResponseBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

const MULTER_ERROR_MESSAGES: Partial<Record<string, string>> = {
  LIMIT_FILE_SIZE: 'This file is too large to upload. Please choose a smaller file.',
  LIMIT_FILE_COUNT: 'Only one file can be uploaded at a time.',
  LIMIT_UNEXPECTED_FILE: 'Only one file can be uploaded at a time.',
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
  if (error instanceof multer.MulterError) {
    const body: ErrorResponseBody = {
      error: {
        code: 'VALIDATION_ERROR',
        message: MULTER_ERROR_MESSAGES[error.code] ?? 'This file could not be uploaded. Please try a different file.',
      },
    }

    res.status(400).json(body)
    return
  }

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

  logger.error(error)

  const body: ErrorResponseBody = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }

  res.status(500).json(body)
}
