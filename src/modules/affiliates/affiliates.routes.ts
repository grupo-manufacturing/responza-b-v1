import { Router } from 'express'
import { z } from 'zod'

import { adminPaginationQuerySchema } from '../admin/admin.schemas.js'
import { requireAdminMiddleware } from '../../shared/middleware/index.js'
import { validateRequest } from '../../shared/middleware/validateRequest.js'
import * as affiliatesService from './affiliates.service.js'
import {
  affiliateIdParamsSchema,
  createAffiliateBodySchema,
  updateAffiliateBodySchema,
} from './affiliates.schemas.js'

export function createAffiliatesAdminRouter(): Router {
  const router = Router()

  router.use(requireAdminMiddleware)

  router.get('/', validateRequest({ query: adminPaginationQuerySchema }), (req, res, next) => {
    void affiliatesService
      .listAffiliates(req.query as unknown as z.infer<typeof adminPaginationQuerySchema>)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post('/', validateRequest({ body: createAffiliateBodySchema }), (req, res, next) => {
    void affiliatesService
      .createAffiliate(req.body)
      .then((result) => {
        res.status(201).json(result)
      })
      .catch(next)
  })

  router.patch(
    '/:id',
    validateRequest({ params: affiliateIdParamsSchema, body: updateAffiliateBodySchema }),
    (req, res, next) => {
      const { id } = req.params as { id: string }
      void affiliatesService
        .updateAffiliate(id, req.body)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  router.get(
    '/:id/referrals',
    validateRequest({ params: affiliateIdParamsSchema }),
    (req, res, next) => {
      const { id } = req.params as { id: string }
      void affiliatesService
        .getAffiliateReferrals(id)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  return router
}
