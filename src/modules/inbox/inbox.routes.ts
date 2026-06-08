import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import {
  conversationIdParamsSchema,
  createMessageBodySchema,
  listInboxQuerySchema,
  listMessagesQuerySchema,
  type CreateMessageBody,
  type ListInboxQuery,
  type ListMessagesQuery,
} from './inbox.schemas.js'
import * as inboxService from './inbox.service.js'

export function createInboxRouter(): Router {
  const router = Router()

  router.get('/', validateRequest({ query: listInboxQuerySchema }), (req, res, next) => {
    if (req.auth === undefined) {
      next()
      return
    }

    void inboxService
      .listInbox(req.auth, req.query as unknown as ListInboxQuery)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  return router
}

export function createConversationsRouter(): Router {
  const router = Router()

  router.get(
    '/:id',
    validateRequest({ params: conversationIdParamsSchema }),
    (req, res, next) => {
      if (req.auth === undefined) {
        next()
        return
      }

      const { id } = req.params as { id: string }

      void inboxService
        .getConversation(req.auth, id)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  router.get(
    '/:id/messages',
    validateRequest({ params: conversationIdParamsSchema, query: listMessagesQuerySchema }),
    (req, res, next) => {
      if (req.auth === undefined) {
        next()
        return
      }

      const { id } = req.params as { id: string }

      void inboxService
        .listConversationMessages(req.auth, id, req.query as unknown as ListMessagesQuery)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  router.post(
    '/:id/messages',
    validateRequest({ params: conversationIdParamsSchema, body: createMessageBodySchema }),
    (req, res, next) => {
      if (req.auth === undefined) {
        next()
        return
      }

      const { id } = req.params as { id: string }

      void inboxService
        .createOutboundMessage(req.auth, id, req.body as CreateMessageBody)
        .then((result) => {
          res.status(201).json(result)
        })
        .catch(next)
    },
  )

  return router
}
