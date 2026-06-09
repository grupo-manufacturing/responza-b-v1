import type { NextFunction, Request, Response } from 'express'

import * as integrationsRepository from '../../modules/integrations/integrations.repository.js'
import {
  integrationPlatformFromApi,
  integrationPlatformToApi,
  isSupportedPlatform,
  SUPPORTED_PLATFORMS,
} from '../../modules/integrations/integrations.constants.js'
import { AppError } from '../errors/index.js'
import type { IntegrationPlatform } from '../../modules/integrations/integrations.constants.js'

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
          requiredPlatform:
            options.platform !== undefined ? integrationPlatformToApi(options.platform) : null,
          availablePlatforms: SUPPORTED_PLATFORMS.map(integrationPlatformToApi),
          connectedPlatforms: connectedPlatforms.map(integrationPlatformToApi),
          disconnectedPlatforms: disconnectedPlatforms.map(integrationPlatformToApi),
        }),
      )
    } catch (error) {
      next(error)
    }
  }
}

export function requireIntegrationPlatformFromParams(paramName = 'platform') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const value = req.params[paramName]

    if (typeof value !== 'string' || !isSupportedPlatform(value)) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Invalid integration platform'))
      return
    }

    req.integrationPlatform = integrationPlatformFromApi(value)
    next()
  }
}
