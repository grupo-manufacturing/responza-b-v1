import type { NextFunction, Request, Response } from 'express'

import * as integrationsRepository from '../../modules/integrations/integrations.repository.js'
import {
  SUPPORTED_PLATFORMS,
  type IntegrationPlatform,
} from '../../modules/integrations/integrations.constants.js'
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

      const organizationId = req.auth.organizationId
      const hasConnection = await integrationsRepository.hasConnectedIntegration(
        organizationId,
        options.platform,
      )

      if (hasConnection) {
        next()
        return
      }

      const connectedPlatforms = await integrationsRepository.listConnectedPlatforms(organizationId)
      const disconnectedPlatforms = SUPPORTED_PLATFORMS.filter(
        (platform) => !connectedPlatforms.includes(platform),
      )

      next(
        new AppError(402, 'INTEGRATIONS_REQUIRED', 'Connect a platform integration to continue.', {
          requiredPlatform: options.platform ?? null,
          availablePlatforms: [...SUPPORTED_PLATFORMS],
          connectedPlatforms,
          disconnectedPlatforms,
        }),
      )
    } catch (error) {
      next(error)
    }
  }
}
