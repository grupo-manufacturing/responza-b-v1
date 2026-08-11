import { Router } from 'express'

import * as knowledgeService from './knowledge.service.js'

export function createKnowledgeRouter(): Router {
  const router = Router()

  router.get('/knowledge-base', (req, res, next) => {
    void knowledgeService
      .getKnowledgeBase(req.auth!)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.get('/agent-status', (req, res, next) => {
    void knowledgeService
      .getAgentStatus(req.auth!)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  return router
}
