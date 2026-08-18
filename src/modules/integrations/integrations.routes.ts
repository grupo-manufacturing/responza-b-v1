import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import {
  connectIntegrationBodySchema,
  integrationPlatformParamsSchema,
  type ConnectIntegrationBody,
} from './integrations.schemas.js'
import * as integrationsService from './integrations.service.js'

export function createIntegrationsRouter(): Router {
  const router = Router()

  router.get('/', (req, res, next) => {
    void integrationsService
      .listIntegrations(req.auth!)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  const mountStatusRoute = (
    path: string,
    handler: (auth: any) => Promise<unknown>,
  ): void => {
    router.get(path, (req, res, next) => {
      void handler(req.auth!).then((result) => {
        res.status(200).json(result)
      }).catch(next)
    })
  }

  // Keep route strings explicit, dedupe handler wiring.
  mountStatusRoute('/whatsapp/status', integrationsService.getWhatsAppConnectionSummary)
  mountStatusRoute('/instagram/status', integrationsService.getInstagramConnectionSummary)
  mountStatusRoute('/gmail/status', integrationsService.getGmailConnectionSummary)

  router.post(
    '/:platform/connect',
    validateRequest({ params: integrationPlatformParamsSchema, body: connectIntegrationBodySchema }),
    (req, res, next) => {
      const { platform } = req.params as { platform: string }

      void integrationsService
        .connectIntegration(req.auth!, platform, req.body as ConnectIntegrationBody)
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
      const { platform } = req.params as { platform: string }

      void integrationsService
        .disconnectIntegration(req.auth!, platform)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  return router
}
