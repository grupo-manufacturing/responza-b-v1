import { Router } from 'express'

import {
  requireIntegrationMiddleware,
  validateRequest,
} from '../../shared/middleware/index.js'
import {
  conversationIdParamsSchema,
  listInboxQuerySchema,
  reactMessageParamsSchema,
  reactToMessageBodySchema,
  sendMessageBodySchema,
  type ListInboxQuery,
  type ReactToMessageBody,
  type SendMessageBody,
} from './inbox.schemas.js'
import * as inboxService from './inbox.service.js'

export function createConversationsRouter(): Router {
  const router = Router()

  router.use(requireIntegrationMiddleware())

  router.get('/', validateRequest({ query: listInboxQuerySchema }), (req, res, next) => {
    void inboxService
      .listConversations(req.auth!, req.query as unknown as ListInboxQuery)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.get('/:id', validateRequest({ params: conversationIdParamsSchema }), (req, res, next) => {
    const { id } = req.params as { id: string }

    void inboxService
      .getConversation(req.auth!, id)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post(
    '/:id/messages',
    validateRequest({ params: conversationIdParamsSchema, body: sendMessageBodySchema }),
    (req, res, next) => {
      const { id } = req.params as { id: string }

      void inboxService
        .sendMessage(req.auth!, id, req.body as SendMessageBody)
        .then((result) => {
          res.status(201).json(result)
        })
        .catch(next)
    },
  )

  router.post(
    '/:id/messages/:messageId/reactions',
    validateRequest({
      params: reactMessageParamsSchema,
      body: reactToMessageBodySchema,
    }),
    (req, res, next) => {
      const { id, messageId } = req.params as { id: string; messageId: string }

      void inboxService
        .reactToMessage(req.auth!, id, messageId, req.body as ReactToMessageBody)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  return router
}
