import { Router } from 'express'

import * as dashboardService from './dashboard.service.js'

export function createDashboardRouter(): Router {
  const router = Router()

  router.get('/', (req, res, next) => {
    void dashboardService
      .getDashboard(req.auth!)
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  return router
}
