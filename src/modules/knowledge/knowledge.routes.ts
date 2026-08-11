import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import * as knowledgeService from './knowledge.service.js'
import { askBodySchema } from './knowledge.schemas.js'

export function createKnowledgeRouter(): Router {
  const router = Router()

  router.post('/ask', validateRequest({ body: askBodySchema }), (req, res, next) => {
    void knowledgeService
      .askQuestion(req.auth!, req.body)
      .then((result) => {
        res.status(200).json(result)
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

  return router
}
