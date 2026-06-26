import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import { createAiRateLimiter } from '../../shared/rate-limit/index.js'
import * as aiService from './ai.service.js'
import {
  conversationAnalyticsBodySchema,
  rewriteBodySchema,
  suggestReplyBodySchema,
  translateBodySchema,
} from './ai.schemas.js'

export function createAiRouter(): Router {
  const router = Router()

  router.use(createAiRateLimiter())

  router.post('/rewrite', validateRequest({ body: rewriteBodySchema }), (req, res, next) => {
    void aiService
      .rewriteDraft(req.body)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post('/translate', validateRequest({ body: translateBodySchema }), (req, res, next) => {
    void aiService
      .translateMessage(req.auth!, req.body)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post(
    '/suggest-reply',
    validateRequest({ body: suggestReplyBodySchema }),
    (req, res, next) => {
      void aiService
        .suggestReply(req.auth!, req.body)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  router.post(
    '/conversation-analytics',
    validateRequest({ body: conversationAnalyticsBodySchema }),
    (req, res, next) => {
      void aiService
        .analyzeConversation(req.auth!, req.body)
        .then((result) => {
          res.status(200).json(result)
        })
        .catch(next)
    },
  )

  return router
}
