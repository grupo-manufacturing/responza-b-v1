import { Router } from 'express'

import { healthRouter } from './health.routes.js'

export function createAppRouter(): Router {
  const router = Router()

  router.use(healthRouter)

  return router
}
