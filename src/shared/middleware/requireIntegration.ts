import type { NextFunction, Request, Response } from 'express'

import { assertHasConnectedIntegration } from '../../modules/integrations/integrations.service.js'
import type { IntegrationPlatform } from '../../modules/integrations/integrations.constants.js'
import { isIntegrationPlatform } from '../../modules/integrations/integrations.constants.js'
import { AppError } from '../errors/index.js'

type RequireIntegrationOptions = {
  platform?: IntegrationPlatform
}

export function requireIntegrationMiddleware(options: RequireIntegrationOptions = {}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.auth === undefined) {
        next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'))
        return
      }

      await assertHasConnectedIntegration(req.auth, options.platform)
      next()
    } catch (error) {
      next(error)
    }
  }
}

export function requireIntegrationFromParam(paramName = 'platform') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.auth === undefined) {
        next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'))
        return
      }

      const platformValue = req.params[paramName]
      const platform =
        typeof platformValue === 'string' && isIntegrationPlatform(platformValue)
          ? platformValue
          : undefined

      await assertHasConnectedIntegration(req.auth, platform)
      next()
    } catch (error) {
      next(error)
    }
  }
}
