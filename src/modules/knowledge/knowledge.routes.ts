import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import * as knowledgeService from './knowledge.service.js'
import { askBodySchema, knowledgeJobParamsSchema } from './knowledge.schemas.js'

export function createKnowledgeRouter(): Router {
  const router = Router()

  router.post('/ingest', (req, res, next) => {
    void knowledgeService
      .startIngestion(req.auth!)
      .then((result) => {
        res.status(202).json(result)
      })
      .catch(next)
  })

  router.get('/ingestion', (req, res, next) => {
    void knowledgeService
      .getIngestionResults(req.auth!)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post('/index', (req, res, next) => {
    void knowledgeService
      .startIndexing(req.auth!)
      .then((result) => {
        res.status(202).json(result)
      })
      .catch(next)
  })

  router.get('/knowledge-base', (req, res, next) => {
    void knowledgeService
      .getKnowledgeBase(req.auth!)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post('/ask', validateRequest({ body: askBodySchema }), (req, res, next) => {
    void knowledgeService
      .askQuestion(req.auth!, req.body)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.get('/jobs/:jobId', validateRequest({ params: knowledgeJobParamsSchema }), (req, res, next) => {
    const { jobId } = req.params as { jobId: string }

    void knowledgeService
      .getJobStatus(req.auth!, jobId)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.post(
    '/jobs/:jobId/retry',
    validateRequest({ params: knowledgeJobParamsSchema }),
    (req, res, next) => {
      const { jobId } = req.params as { jobId: string }

      void knowledgeService
        .retryJob(req.auth!, jobId)
        .then((result) => {
          res.status(202).json(result)
        })
        .catch(next)
    },
  )

  return router
}
