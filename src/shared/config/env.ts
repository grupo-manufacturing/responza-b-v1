import { resolve } from 'node:path'

import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(1),
  HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().positive().default(10000),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null
let dotenvLoaded = false

function ensureDotenvLoaded(): void {
  if (dotenvLoaded) {
    return
  }

  loadDotenv({ path: resolve(process.cwd(), '.env') })
  dotenvLoaded = true
}

export function loadEnv(): Env {
  ensureDotenvLoaded()

  if (cachedEnv !== null) {
    return cachedEnv
  }

  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    throw new Error(`Invalid environment configuration: ${details}`)
  }

  cachedEnv = parsed.data
  return cachedEnv
}

export function getCorsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}
