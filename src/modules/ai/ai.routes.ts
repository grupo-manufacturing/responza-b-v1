import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import { createAiRateLimiter } from '../../shared/rate-limit/index.js'
import * as aiJobsService from './ai.jobs.service.js'
import {
  aiJobParamsSchema,
  conversationAnalyticsBodySchema,
  suggestReplyBodySchema,
  translateBodySchema,
} from './ai.schemas.js'

export function createAiRouter(): Router {
  const router = Router()
  const rateLimiter = createAiRateLimiter()

  router.get('/jobs/:jobId', validateRequest({ params: aiJobParamsSchema }), (req, res, next) => {
    const { jobId } = req.params as { jobId: string }

    void aiJobsService
      .getAiJobStatus(req.auth!, jobId)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post(
    '/translate',
    rateLimiter,
    validateRequest({ body: translateBodySchema }),
    (req, res, next) => {
      void aiJobsService
        .enqueueTranslateJob(req.auth!, req.body)
        .then((result) => {
          res.status(202).json(result)
        })
        .catch(next)
    },
  )

  router.post(
    '/suggest-reply',
    rateLimiter,
    validateRequest({ body: suggestReplyBodySchema }),
    (req, res, next) => {
      void aiJobsService
        .enqueueSuggestReplyJob(req.auth!, req.body)
        .then((result) => {
          res.status(202).json(result)
        })
        .catch(next)
    },
  )

  router.post(
    '/conversation-analytics',
    rateLimiter,
    validateRequest({ body: conversationAnalyticsBodySchema }),
    (req, res, next) => {
      void aiJobsService
        .enqueueConversationAnalyticsJob(req.auth!, req.body)
        .then((result) => {
          res.status(202).json(result)
        })
        .catch(next)
    },
  )

  return router
}
