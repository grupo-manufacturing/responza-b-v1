import { Router } from 'express'

import { validateRequest } from '../../shared/middleware/index.js'
import type { AuthSessionPayload } from '../../shared/auth/index.js'
import { loginBodySchema, registerBodySchema } from './auth.schemas.js'
import * as authService from './auth.service.js'

function toSessionResponse(payload: AuthSessionPayload) {
  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    expiresIn: payload.expiresIn,
    organization: payload.organization,
    subscription: payload.subscription,
    businessDetails: payload.businessDetails,
  }
}

function toMeResponse(payload: AuthSessionPayload) {
  return {
    organization: payload.organization,
    subscription: payload.subscription,
    businessDetails: payload.businessDetails,
  }
}

export function createAuthPublicRouter(): Router {
  const router = Router()

  router.post(
    '/register',
    validateRequest({ body: registerBodySchema }),
    (req, res, next) => {
      void authService
        .registerOrganization(req.body)
        .then((payload) => {
          res.status(201).json(toSessionResponse(payload))
        })
        .catch(next)
    },
  )

  router.post('/login', validateRequest({ body: loginBodySchema }), (req, res, next) => {
    void authService
      .loginOrganization(req.body)
      .then((payload) => {
        res.status(200).json(toSessionResponse(payload))
      })
      .catch(next)
  })

  return router
}

export function createAuthProtectedRouter(): Router {
  const router = Router()

  router.get('/me', (req, res, next) => {
    if (req.auth === undefined) {
      next()
      return
    }

    void authService
      .getCurrentOrganization(req.auth)
      .then((payload) => {
        res.status(200).json(toMeResponse(payload))
      })
      .catch(next)
  })

  return router
}
