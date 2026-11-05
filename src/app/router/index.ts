import { Router } from 'express'

import { healthRouter } from './health.routes.js'
import { waitlistRouter } from './waitlist.routes.js'

export function createAppRouter(): Router {
  const router = Router()

  router.use(healthRouter)
  router.use(waitlistRouter)

  return router
}
