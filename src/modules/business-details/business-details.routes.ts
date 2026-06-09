import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import { completeBusinessDetailsBodySchema } from './business-details.schemas.js'
import * as businessDetailsService from './business-details.service.js'

export function createBusinessDetailsRouter(): Router {
  const router = Router()

  router.get('/', (req, res, next) => {
    void businessDetailsService
      .getBusinessDetails(req.auth!)
      .then((profile) => {
        res.status(200).json({ profile })
      })
      .catch(next)
  })

  router.post(
    '/complete',
    validateRequest({ body: completeBusinessDetailsBodySchema }),
    (req, res, next) => {
      void businessDetailsService
        .completeBusinessDetails(req.auth!, req.body)
        .then((profile) => {
          res.status(200).json({ profile })
        })
        .catch(next)
    },
  )

  return router
}
