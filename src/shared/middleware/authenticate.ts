import type { NextFunction, Request, Response } from 'express'

import { resolveAuthContextFromAccessToken } from '../../modules/auth/auth.service.js'
import { AppError } from '../errors/index.js'

function extractBearerToken(req: Request): string | null {
  const header = req.header('authorization')
  if (header === undefined) {
    return null
  }

  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || token === undefined || token.trim().length === 0) {
    return null
  }

  return token.trim()
}

export async function authenticateMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req)
    if (token === null) {
      next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'))
      return
    }

    const auth = await resolveAuthContextFromAccessToken(token)
    req.auth = auth
    req.tenant = { organizationId: auth.organizationId }
    next()
  } catch (error) {
    next(error)
  }
}
