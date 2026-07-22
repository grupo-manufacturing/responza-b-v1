import { Router } from 'express'

import { getCorsOrigins, loadEnv } from '../../../shared/config/index.js'

function oauthCallbackHtml(input: {
  title: string
  message: string
  payload: Record<string, unknown>
  targetOrigins: string[]
}): string {
  const serializedPayload = JSON.stringify(input.payload)
  const serializedOrigins = JSON.stringify(input.targetOrigins)

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${input.title}</title>
</head>
<body style="font-family:system-ui,sans-serif;padding:24px;background:#111827;color:#f9fafb;">
  <h3 style="margin:0 0 8px;">${input.title}</h3>
  <p style="margin:0;color:#d1d5db;">${input.message}</p>
  <script>
    (function () {
      var payload = ${serializedPayload};
      var targetOrigins = ${serializedOrigins};
      if (window.opener && !window.opener.closed) {
        for (var i = 0; i < targetOrigins.length; i += 1) {
          try {
            window.opener.postMessage(payload, targetOrigins[i]);
          } catch (error) {
            void error;
          }
        }
      }
      setTimeout(function () {
        window.close();
      }, 150);
    })();
  </script>
</body>
</html>`
}

export function createGmailOAuthRouter(): Router {
  const router = Router()

  router.get('/gmail/callback', (req, res) => {
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
      res.status(200).send(
        oauthCallbackHtml({
          title: 'Gmail login canceled',
          message: 'You can close this window and try again.',
          targetOrigins,
          payload: {
            type: 'GMAIL_OAUTH_ERROR',
            error: 'Gmail authorization was canceled',
          },
        }),
      )
      return
    }

    const code = typeof req.query.code === 'string' ? req.query.code.replace(/#_$/, '').trim() : ''
    const state = typeof req.query.state === 'string' ? req.query.state.trim() : ''

    if (code.length === 0) {
      res.status(400).send(
        oauthCallbackHtml({
          title: 'Gmail login failed',
          message: 'No authorization code was returned.',
          targetOrigins,
          payload: {
            type: 'GMAIL_OAUTH_ERROR',
            error: 'No authorization code received',
          },
        }),
      )
      return
    }

    res.status(200).send(
      oauthCallbackHtml({
        title: 'Gmail connected',
        message: 'Finishing setup. This window will close automatically.',
        targetOrigins,
        payload: {
          type: 'GMAIL_OAUTH_SUCCESS',
          code,
          ...(state.length > 0 ? { state } : {}),
        },
      }),
    )
  })

  return router
}
