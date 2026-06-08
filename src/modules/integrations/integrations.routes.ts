import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import type { IntegrationPlatform } from './integrations.constants.js'
import {
  integrationConnectBodySchema,
  integrationPlatformParamsSchema,
} from './integrations.schemas.js'
import * as integrationsService from './integrations.service.js'

export function createIntegrationsRouter(): Router {
  const router = Router()

  router.get('/', (req, res, next) => {
    if (req.auth === undefined) {
      next()
      return
    }

    void integrationsService
      .listIntegrations(req.auth)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post(
    '/:platform/connect',
    validateRequest({
      params: integrationPlatformParamsSchema,
      body: integrationConnectBodySchema,
    }),
    (req, res, next) => {
      if (req.auth === undefined) {
        next()
        return
      }

      const { platform } = req.params as { platform: IntegrationPlatform }

      void integrationsService
        .connectIntegration(req.auth, platform, req.body)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  router.delete(
    '/:platform',
    validateRequest({ params: integrationPlatformParamsSchema }),
    (req, res, next) => {
      if (req.auth === undefined) {
        next()
        return
      }

      const { platform } = req.params as { platform: IntegrationPlatform }

      void integrationsService
        .disconnectIntegration(req.auth, platform)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  return router
}
