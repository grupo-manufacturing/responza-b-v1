import type { Request, Response, Router } from 'express'
import { Router as createRouter } from 'express'

import { getCorsOrigins, loadEnv } from '../../../shared/config/index.js'
import { oauthCallbackHtml } from './oauth-callback-html.js'

type OAuthCallbackConfig = {
  path: string
  providerLabel: string
  successType: string
  errorType: string
  includeState?: boolean
}

function sendOAuthCallbackPage(
  res: Response,
  status: number,
  input: {
    title: string
    message: string
    payload: Record<string, unknown>
    targetOrigins: string[]
  },
): void {
  res.status(status).send(oauthCallbackHtml(input))
}

export function createOAuthCallbackRouter(config: OAuthCallbackConfig): Router {
  const router = createRouter()

  router.get(config.path, (req: Request, res: Response) => {
    const env = loadEnv()
    const targetOrigins = getCorsOrigins(env)

    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none')
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none')

    const oauthError =
      typeof req.query.error === 'string'
        ? req.query.error
        : typeof req.query.error_reason === 'string'
          ? req.query.error_reason
          : null

    if (oauthError !== null) {
      sendOAuthCallbackPage(res, 200, {
        title: `${config.providerLabel} login canceled`,
        message: 'You can close this window and try again.',
        targetOrigins,
        payload: {
          type: config.errorType,
          error: `${config.providerLabel} authorization was canceled`,
        },
      })
      return
    }

    const code = typeof req.query.code === 'string' ? req.query.code.replace(/#_$/, '').trim() : ''
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : ''

    if (code.length === 0) {
      sendOAuthCallbackPage(res, 400, {
        title: `${config.providerLabel} login failed`,
        message: 'No authorization code was returned.',
        targetOrigins,
        payload: {
          type: config.errorType,
          error: 'No authorization code received',
        },
      })
      return
    }

    sendOAuthCallbackPage(res, 200, {
      title: `${config.providerLabel} connected`,
      message: 'Finishing setup. This window will close automatically.',
      targetOrigins,
      payload: {
        type: config.successType,
        code,
        ...(config.includeState === true && state.length > 0 ? { state } : {}),
      },
    })
  })

  return router
}
