import { Router } from 'express'
import { z } from 'zod'

import { createAffiliatesAdminRouter } from '../affiliates/affiliates.routes.js'
import { requireAdminMiddleware } from '../../shared/middleware/index.js'
import { validateRequest } from '../../shared/middleware/validateRequest.js'
import * as adminService from './admin.service.js'

const adminLoginBodySchema = z.object({
  username: z.string().trim().min(1).max(160),
  password: z.string().min(1).max(256),
})

export function createAdminRouter(): Router {
  const router = Router()

  router.post('/login', validateRequest({ body: adminLoginBodySchema }), (req, res, next) => {
    try {
      const result = adminService.loginAdmin(req.body)
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  })

  router.get('/me', requireAdminMiddleware, (req, res) => {
    res.status(200).json({ username: req.admin!.username })
  })

  router.get('/dashboard', requireAdminMiddleware, (_req, res, next) => {
    void adminService
      .getAdminDashboard()
      .then((result) => {
        res.status(200).json(result)
      })
      .catch(next)
  })

  router.use('/affiliates', createAffiliatesAdminRouter())

  return router
}
