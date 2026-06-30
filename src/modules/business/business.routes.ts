import { Router } from 'express'

import {
  businessCatalogueUpload,
  validateRequest,
} from '../../shared/middleware/index.js'
import {
  catalogueFileParamsSchema,
  completeBusinessBodySchema,
  updateBusinessBodySchema,
  type CompleteBusinessBody,
  type UpdateBusinessBody,
} from './business.schemas.js'
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
        .completeBusiness(req.auth!, req.body as CompleteBusinessBody)
        .then((profile) => {
          res.status(200).json({ profile })
        })
        .catch(next)
    },
  )

  router.patch('/', validateRequest({ body: updateBusinessBodySchema }), (req, res, next) => {
    void businessService
      .updateBusiness(req.auth!, req.body as UpdateBusinessBody)
      .then((profile) => {
        res.status(200).json({ profile })
      })
      .catch(next)
  })

  router.post('/catalogue', businessCatalogueUpload.single('file'), (req, res, next) => {
    void businessService
      .uploadCatalogueFile(req.auth!, req.file)
      .then((result) => {
        res.status(201).json(result)
      })
      .catch(next)
  })

  router.delete(
    '/catalogue/:fileId',
    validateRequest({ params: catalogueFileParamsSchema }),
    (req, res, next) => {
      const { fileId } = req.params as { fileId: string }

      void businessService
        .deleteCatalogueFile(req.auth!, fileId)
        .then((profile) => {
          res.status(200).json({ profile })
        })
        .catch(next)
    },
  )

  return router
}
