import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import {
  createLeadBodySchema,
  leadIdParamsSchema,
  listLeadsQuerySchema,
  updateLeadBodySchema,
  type CreateLeadBody,
  type ListLeadsQuery,
  type UpdateLeadBody,
} from './leads.schemas.js'
import * as leadsService from './leads.service.js'

export function createLeadsRouter(): Router {
  const router = Router()

  router.get('/', validateRequest({ query: listLeadsQuerySchema }), (req, res, next) => {
    void leadsService
      .listLeads(req.auth!, req.query as unknown as ListLeadsQuery)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.get('/:id', validateRequest({ params: leadIdParamsSchema }), (req, res, next) => {
    const { id } = req.params as { id: string }

    void leadsService
      .getLead(req.auth!, id)
      .then((lead) => {
        res.status(200).json({ lead })
      })
      .catch(next)
  })

  router.post('/', validateRequest({ body: createLeadBodySchema }), (req, res, next) => {
    void leadsService
      .createLead(req.auth!, req.body as CreateLeadBody)
      .then((lead) => {
        res.status(201).json({ lead })
      })
      .catch(next)
  })

  router.patch(
    '/:id',
    validateRequest({ params: leadIdParamsSchema, body: updateLeadBodySchema }),
    (req, res, next) => {
      const { id: leadId } = req.params as { id: string }

      void leadsService
        .updateLead(req.auth!, leadId, req.body as UpdateLeadBody)
        .then((lead) => {
          res.status(200).json({ lead })
        })
        .catch(next)
    },
  )

  router.delete('/:id', validateRequest({ params: leadIdParamsSchema }), (req, res, next) => {
    const { id: leadId } = req.params as { id: string }

    void leadsService
      .deleteLead(req.auth!, leadId)
      .then(() => {
        res.status(204).send()
      })
      .catch(next)
  })

  return router
}
