import type { NextFunction, Request, Response } from 'express'

import { verifyAdminToken } from '../admin/session.js'
import { AppError } from '../errors/index.js'
import { extractBearerToken } from './authenticate.js'

export function requireAdminMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req)
    if (token === null) {
      next(new AppError(401, 'UNAUTHORIZED', 'Admin authentication required'))
      return
    }

    req.admin = verifyAdminToken(token)
    next()
  } catch (error) {
    next(error)
  }
}
