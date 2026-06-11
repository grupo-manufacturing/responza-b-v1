import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import { completeBusinessBodySchema } from './business.schemas.js'
import * as businessService from './business.service.js'

export function createBusinessRouter(): Router {
  const router = Router()

  router.get('/', (req, res, next) => {
    void businessService
      .getBusiness(req.auth!)
      .then((profile) => {
        res.status(200).json({ profile })
      })
      .catch(next)
  })

  router.post(
    '/complete',
    validateRequest({ body: completeBusinessBodySchema }),
    (req, res, next) => {
      void businessService
        .completeBusiness(req.auth!, req.body)
        .then((profile) => {
          res.status(200).json({ profile })
        })
        .catch(next)
    },
  )

  return router
}
