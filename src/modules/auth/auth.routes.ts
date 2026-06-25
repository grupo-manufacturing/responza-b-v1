import { Router } from 'express'

import { AppError } from '../../shared/errors/index.js'
import { validateRequest } from '../../shared/middleware/index.js'
import { extractBearerToken } from '../../shared/middleware/authenticate.js'
import type { AuthSessionPayload } from '../../shared/auth/index.js'
import * as authService from './auth.service.js'
import {
  changePasswordBodySchema,
  loginBodySchema,
  oauthCompleteBodySchema,
  registerBodySchema,
  resendOtpBodySchema,
  updateProfileBodySchema,
  verifyOtpBodySchema,
} from './auth.service.js'

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
          if ('requiresVerification' in payload) {
            res.status(201).json(payload)
            return
          }

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

  router.post('/verify-otp', validateRequest({ body: verifyOtpBodySchema }), (req, res, next) => {
    void authService
      .verifyEmailOtp(req.body)
      .then((payload) => {
        res.status(200).json(toSessionResponse(payload))
      })
      .catch(next)
  })

  router.post('/resend-otp', validateRequest({ body: resendOtpBodySchema }), (req, res, next) => {
    void authService
      .resendEmailOtp(req.body)
      .then(() => {
        res.status(200).json({ success: true })
      })
      .catch(next)
  })

  router.post(
    '/oauth/complete',
    validateRequest({ body: oauthCompleteBodySchema }),
    (req, res, next) => {
      const accessToken = extractBearerToken(req)
      if (accessToken === null) {
        next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'))
        return
      }

      void authService
        .completeOAuthSession(accessToken, req.body)
        .then((payload) => {
          res.status(200).json(toSessionResponse(payload))
        })
        .catch(next)
    },
  )

  return router
}

export function createAuthProtectedRouter(): Router {
  const router = Router()

  router.get('/translation-languages', (_req, res) => {
    res.status(200).json(authService.listTranslationLanguages())
  })

  router.get('/me', (req, res, next) => {
    void authService
      .getCurrentOrganization(req.auth!)
      .then((payload) => {
        res.status(200).json(toMeResponse(payload))
      })
      .catch(next)
  })

  router.patch('/me', validateRequest({ body: updateProfileBodySchema }), (req, res, next) => {
    void authService
      .updateProfile(req.auth!, req.body)
      .then((payload) => {
        res.status(200).json(toMeResponse(payload))
      })
      .catch(next)
  })

  router.post(
    '/change-password',
    validateRequest({ body: changePasswordBodySchema }),
    (req, res, next) => {
      void authService
        .changePassword(req.auth!, req.body)
        .then(() => {
          res.status(200).json({ success: true })
        })
        .catch(next)
    },
  )

  return router
}
