import { Router } from 'express'

import { requireIntegrationMiddleware, validateRequest } from '../../shared/middleware/index.js'
import * as gmailService from './gmail.service.js'
import {
  gmailMessageParamsSchema,
  listGmailMessagesQuerySchema,
  replyGmailMessageBodySchema,
  sendGmailMessageBodySchema,
  type ListGmailMessagesQuery,
  type ReplyGmailMessageBody,
  type SendGmailMessageBody,
} from './gmail.schemas.js'

export function createGmailRouter(): Router {
  const router = Router()

  router.use(requireIntegrationMiddleware({ platform: 'gmail' }))

  router.get('/messages', validateRequest({ query: listGmailMessagesQuerySchema }), (req, res, next) => {
    void gmailService
      .listMessages(req.auth!, req.query as unknown as ListGmailMessagesQuery)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post('/messages/send', validateRequest({ body: sendGmailMessageBodySchema }), (req, res, next) => {
    void gmailService
      .sendMessage(req.auth!, req.body as SendGmailMessageBody)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.get('/messages/:id', validateRequest({ params: gmailMessageParamsSchema }), (req, res, next) => {
    const { id } = req.params as { id: string }

    void gmailService
      .getMessage(req.auth!, id)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post(
    '/messages/:id/reply',
    validateRequest({ params: gmailMessageParamsSchema, body: replyGmailMessageBodySchema }),
    (req, res, next) => {
      const { id } = req.params as { id: string }

      void gmailService
        .replyToMessage(req.auth!, id, req.body as ReplyGmailMessageBody)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  return router
}
