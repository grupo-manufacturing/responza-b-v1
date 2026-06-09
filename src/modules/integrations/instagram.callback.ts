import { getFrontendOrigin, loadEnv } from '../../shared/config/index.js'

type CallbackPayload = {
  type: 'INSTAGRAM_BUSINESS_LOGIN'
  status: 'success' | 'error'
  data?: {
    igUserId: string
    igUsername: string
  }
  error?: string
  details?: unknown
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderCallbackHtml(input: {
  title: string
  message: string
  payload: CallbackPayload
  closeWindow: boolean
}): string {
  const env = loadEnv()
  const targetOrigin = getFrontendOrigin(env)
  const serializedPayload = JSON.stringify(input.payload)
  const closeScript = input.closeWindow ? 'window.close();' : ''

  return `<!doctype html>
<html>
  <body style="font-family:system-ui;padding:20px;background:#0b1020;color:#fff;">
    <h3>${escapeHtml(input.title)}</h3>
    <p>${escapeHtml(input.message)}</p>
    <script>
      (function () {
        var payload = ${serializedPayload};
        if (window.opener) {
          window.opener.postMessage(payload, ${JSON.stringify(targetOrigin)});
          ${closeScript}
        }
      })();
    </script>
  </body>
</html>`
}

export function renderInstagramOAuthCanceledPage(): string {
  return renderCallbackHtml({
    title: 'Instagram login canceled',
    message: 'You can close this window and retry.',
    payload: {
      type: 'INSTAGRAM_BUSINESS_LOGIN',
      status: 'error',
      error: 'Instagram authorization was canceled',
    },
    closeWindow: false,
  })
}

export function renderInstagramOAuthSuccessPage(data: {
  igUserId: string
  igUsername: string
}): string {
  return renderCallbackHtml({
    title: 'Instagram connected',
    message: 'You can close this window and continue in Responza.',
    payload: {
      type: 'INSTAGRAM_BUSINESS_LOGIN',
      status: 'success',
      data: {
        igUserId: data.igUserId,
        igUsername: data.igUsername,
      },
    },
    closeWindow: true,
  })
}

export function renderInstagramOAuthErrorPage(input: {
  error: string
  details?: unknown
}): string {
  return renderCallbackHtml({
    title: 'Instagram connection failed',
    message: 'Please close this window and retry.',
    payload: {
      type: 'INSTAGRAM_BUSINESS_LOGIN',
      status: 'error',
      error: input.error,
      details: input.details,
    },
    closeWindow: false,
  })
}
