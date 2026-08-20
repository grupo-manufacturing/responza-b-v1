import { Router } from 'express'

import { validateRequest, requirePaidSubscriptionMiddleware } from '../../shared/middleware/index.js'
import { createAiRateLimiter } from '../../shared/rate-limit/index.js'
import * as assistantService from './assistant.service.js'
import { assistantAskBodySchema } from './assistant.schemas.js'

export function createAssistantRouter(): Router {
  const router = Router()
  const rateLimiter = createAiRateLimiter()

  router.post(
    '/ask',
    requirePaidSubscriptionMiddleware,
    rateLimiter,
    validateRequest({ body: assistantAskBodySchema }),
    (req, res, next) => {
      void assistantService
        .askAssistant(req.auth!, req.body)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  return router
}
