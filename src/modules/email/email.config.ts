import { loadEnv, getCorsOrigins } from '../../shared/config/index.js'

export function isResendConfigured(): boolean {
  const env = loadEnv()
  return env.RESEND_API_KEY.length > 0 && env.RESEND_FROM_EMAIL.length > 0
}

export function getResendFromEmail(): string {
  return loadEnv().RESEND_FROM_EMAIL
}

export function getResendApiKey(): string {
  return loadEnv().RESEND_API_KEY
}

export function getFrontendPublicUrl(): string {
  const env = loadEnv()
  if (env.FRONTEND_PUBLIC_URL.length > 0) {
    return env.FRONTEND_PUBLIC_URL.replace(/\/$/, '')
  }

  const corsOrigin = getCorsOrigins(env)[0]
  if (corsOrigin !== undefined && corsOrigin.length > 0) {
    return corsOrigin.replace(/\/$/, '')
  }

  return 'https://www.responza.in'
}
