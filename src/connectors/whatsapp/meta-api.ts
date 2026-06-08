import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import { WHATSAPP_MESSAGING_PRODUCT } from './constants.js'

export type WhatsAppCredentials = {
  accessToken: string
  phoneNumberId: string
}

function graphBaseUrl(): string {
  const env = loadEnv()
  return `https://graph.facebook.com/${env.WHATSAPP_GRAPH_VERSION}`
}

function requireMetaAppCredentials(): { appId: string; appSecret: string } {
  const env = loadEnv()
  const appId = env.META_APP_ID.trim()
  const appSecret = env.META_APP_SECRET.trim()

  if (appId.length === 0 || appSecret.length === 0) {
    throw new AppError(
      500,
      'CONFIG_ERROR',
      'META_APP_ID and META_APP_SECRET must be configured for WhatsApp',
    )
  }

  return { appId, appSecret }
}

export async function exchangeEmbeddedSignupCode(code: string): Promise<string> {
  const { appId, appSecret } = requireMetaAppCredentials()
  const url = new URL(`${graphBaseUrl()}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('code', code)

  const response = await fetch(url)
  const payload = (await response.json()) as { access_token?: string; error?: { message?: string } }

  if (!response.ok || typeof payload.access_token !== 'string' || payload.access_token.length === 0) {
    throw new AppError(
      502,
      'UPSTREAM_ERROR',
      payload.error?.message ?? 'WhatsApp token exchange failed',
    )
  }

  return payload.access_token
}

export async function sendWhatsAppTextMessage(
  credentials: WhatsAppCredentials,
  input: { to: string; body: string },
): Promise<{ platformMessageId: string }> {
  const url = `${graphBaseUrl()}/${credentials.phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: WHATSAPP_MESSAGING_PRODUCT,
      to: input.to,
      type: 'text',
      text: { body: input.body },
    }),
  })

  const payload = (await response.json()) as {
    messages?: Array<{ id?: string }>
    error?: { message?: string }
  }

  if (!response.ok) {
    throw new AppError(502, 'UPSTREAM_ERROR', payload.error?.message ?? 'WhatsApp send failed')
  }

  const platformMessageId = payload.messages?.[0]?.id
  if (typeof platformMessageId !== 'string' || platformMessageId.length === 0) {
    throw new AppError(502, 'UPSTREAM_ERROR', 'WhatsApp send returned no message id')
  }

  return { platformMessageId }
}
