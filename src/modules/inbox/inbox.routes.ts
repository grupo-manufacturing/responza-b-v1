import { Router } from 'express'

import {
  outboundMediaUpload,
  requireIntegrationMiddleware,
  validateRequest,
} from '../../shared/middleware/index.js'
import {
  conversationIdParamsSchema,
  getConversationQuerySchema,
  listInboxQuerySchema,
  reactMessageParamsSchema,
  reactToMessageBodySchema,
  sendMessageBodySchema,
  uploadOutboundMediaFieldsSchema,
  type GetConversationQuery,
  type ListInboxQuery,
  type ReactToMessageBody,
  type SendMessageBody,
  type UploadOutboundMediaFields,
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

  router.get(
    '/:id',
    validateRequest({ params: conversationIdParamsSchema, query: getConversationQuerySchema }),
    (req, res, next) => {
      const { id } = req.params as { id: string }

      void inboxService
        .getConversation(req.auth!, id, req.query as unknown as GetConversationQuery)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  router.post(
    '/:id/messages/media',
    validateRequest({ params: conversationIdParamsSchema }),
    outboundMediaUpload.single('file'),
    (req, res, next) => {
      const { id } = req.params as { id: string }

      try {
        const fields = uploadOutboundMediaFieldsSchema.parse({
          contentType: req.body.contentType,
          filename: req.body.filename,
        })

        void inboxService
          .uploadOutboundMedia(req.auth!, id, fields as UploadOutboundMediaFields, req.file)
          .then((result) => {
            res.status(201).json(result)
          })
          .catch(next)
      } catch (error) {
        next(error)
      }
    },
  )

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
