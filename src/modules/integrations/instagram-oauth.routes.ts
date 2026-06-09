import { Router } from 'express'

import { getCorsOrigins, loadEnv } from '../../shared/config/index.js'

function oauthCallbackHtml(input: {
  title: string
  message: string
  payload: Record<string, unknown>
  frontendOrigin: string
}): string {
  const serializedPayload = JSON.stringify(input.payload)
  const serializedOrigin = JSON.stringify(input.frontendOrigin)

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
      var targetOrigin = ${serializedOrigin};
      if (window.opener) {
        window.opener.postMessage(payload, targetOrigin);
        window.close();
      }
    })();
  </script>
</body>
</html>`
}

export function createInstagramOAuthRouter(): Router {
  const router = Router()

  router.get('/instagram/callback', (req, res) => {
    const env = loadEnv()
    const frontendOrigin = getCorsOrigins(env)[0] ?? 'http://localhost:5173'

    const oauthError =
      typeof req.query.error === 'string'
        ? req.query.error
        : typeof req.query.error_reason === 'string'
          ? req.query.error_reason
          : null

    if (oauthError !== null) {
      res.status(200).send(
        oauthCallbackHtml({
          title: 'Instagram login canceled',
          message: 'You can close this window and try again.',
          frontendOrigin,
          payload: {
            type: 'INSTAGRAM_OAUTH_ERROR',
            error: 'Instagram authorization was canceled',
          },
        }),
      )
      return
    }

    const code = typeof req.query.code === 'string' ? req.query.code.replace(/#_$/, '').trim() : ''

    if (code.length === 0) {
      res.status(400).send(
        oauthCallbackHtml({
          title: 'Instagram login failed',
          message: 'No authorization code was returned.',
          frontendOrigin,
          payload: {
            type: 'INSTAGRAM_OAUTH_ERROR',
            error: 'No authorization code received',
          },
        }),
      )
      return
    }

    res.status(200).send(
      oauthCallbackHtml({
        title: 'Instagram connected',
        message: 'Finishing setup. This window will close automatically.',
        frontendOrigin,
        payload: {
          type: 'INSTAGRAM_OAUTH_SUCCESS',
          code,
        },
      }),
    )
  })

  return router
}
