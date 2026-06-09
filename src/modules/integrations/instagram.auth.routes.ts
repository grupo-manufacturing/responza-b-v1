import { Router } from 'express'

import { isAppError } from '../../shared/errors/index.js'
import * as integrationsService from './integrations.service.js'
import {
  renderInstagramOAuthCanceledPage,
  renderInstagramOAuthErrorPage,
  renderInstagramOAuthSuccessPage,
} from './instagram.callback.js'

export function createInstagramAuthRouter(): Router {
  const router = Router()

  router.get('/callback', (req, res) => {
    const oauthError = req.query.error ?? req.query.error_reason
    if (typeof oauthError === 'string' && oauthError.length > 0) {
      res.status(200).send(renderInstagramOAuthCanceledPage())
      return
    }

    const code = typeof req.query.code === 'string' ? req.query.code : undefined
    const state = typeof req.query.state === 'string' ? req.query.state : undefined

    if (code === undefined || code.length === 0) {
      res.status(400).send('Missing code query parameter')
      return
    }

    if (state === undefined || state.length === 0) {
      res.status(400).send('Missing state query parameter')
      return
    }

    void integrationsService
      .completeInstagramOAuthCallback({ code, state })
      .then((result) => {
        res.status(200).send(
          renderInstagramOAuthSuccessPage({
            igUserId: result.ig_user_id,
            igUsername: result.ig_username,
          }),
        )
      })
      .catch((error: unknown) => {
        const message = isAppError(error) ? error.message : 'Instagram login flow failed'
        const details = isAppError(error) ? error.details : undefined

        res.status(200).send(
          renderInstagramOAuthErrorPage({
            error: message,
            details,
          }),
        )
      })
  })

  return router
}
