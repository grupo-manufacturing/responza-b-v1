import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import { updateAgentSettingsBodySchema, type UpdateAgentSettingsBody } from './agent.schemas.js'
import * as agentSettingsService from './agent.settings.service.js'

export function createAgentRouter(): Router {
  const router = Router()

  router.get('/settings', (req, res, next) => {
    void agentSettingsService
      .getAgentSettings(req.auth!)
      .then((settings) => {
        res.status(200).json({ settings })
      })
      .catch(next)
  })

  router.patch('/settings', validateRequest({ body: updateAgentSettingsBodySchema }), (req, res, next) => {
    void agentSettingsService
      .updateAgentSettings(req.auth!, req.body as UpdateAgentSettingsBody)
      .then((settings) => {
        res.status(200).json({ settings })
      })
      .catch(next)
  })

  return router
}
