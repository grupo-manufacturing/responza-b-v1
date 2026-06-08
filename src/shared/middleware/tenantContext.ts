import type { NextFunction, Request, Response } from 'express'

import { AppError } from '../errors/index.js'

export type TenantContext = {
  readonly organizationId: string
}

/**
 * Derives tenant context from the authenticated user (Phase 1+).
 */
export function tenantContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.auth !== undefined) {
    req.tenant = { organizationId: req.auth.organizationId }
  }

  next()
}

export function requireTenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.tenant?.organizationId === undefined) {
    next(new AppError(403, 'TENANT_REQUIRED', 'Organization context is required for this request'))
    return
  }

  next()
}
