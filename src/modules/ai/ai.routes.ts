import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import * as aiService from './ai.service.js'
import { rewriteBodySchema } from './ai.schemas.js'

export function createAiRouter(): Router {
  const router = Router()

  router.post('/rewrite', validateRequest({ body: rewriteBodySchema }), (req, res, next) => {
    void aiService
      .rewriteDraft(req.auth!, req.body)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  return router
}
