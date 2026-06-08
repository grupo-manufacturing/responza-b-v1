import type { NextFunction, Request, Response } from 'express'
import type { ZodTypeAny } from 'zod'
import { ZodError } from 'zod'

import { AppError } from '../errors/index.js'

type RequestValidationSchemas = {
  readonly body?: ZodTypeAny
  readonly query?: ZodTypeAny
  readonly params?: ZodTypeAny
}

export function validateRequest(schemas: RequestValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body !== undefined) {
        req.body = schemas.body.parse(req.body ?? {})
      }

      if (schemas.query !== undefined) {
        req.query = schemas.query.parse(req.query)
      }

      if (schemas.params !== undefined) {
        req.params = schemas.params.parse(req.params)
      }

      next()
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', error.flatten()),
        )
        return
      }

      next(error)
    }
  }
}
