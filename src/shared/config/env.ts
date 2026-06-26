import { resolve } from 'node:path'

import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  REDIS_URL: z.string().trim().min(1).default('redis://localhost:6379'),
  CACHE_AUTH_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  CACHE_SUBSCRIPTION_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_AUTH_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  RATE_LIMIT_AUTH_REGISTER_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_REGISTER_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_AUTH_OTP_MAX: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_AUTH_OTP_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  RATE_LIMIT_AI_MAX: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_AI_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TRIAL_DURATION_DAYS: z.coerce.number().int().positive().default(7),
  SUBSCRIPTION_PERIOD_DAYS: z.coerce.number().int().positive().default(30),
  WHATSAPP_GRAPH_VERSION: z.string().trim().min(1).default('v25.0'),
  META_APP_ID: z.string().default(''),
  META_APP_SECRET: z.string().default(''),
  WEBHOOK_VERIFY_TOKEN: z.string().default(''),
  INSTAGRAM_GRAPH_VERSION: z.string().trim().min(1).default('v25.0'),
  INSTAGRAM_APP_ID: z.string().default(''),
  INSTAGRAM_APP_SECRET: z.string().default(''),
  INSTAGRAM_REDIRECT_URI: z.string().default(''),
  AI_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true' || value === '1'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().trim().min(1).default('gpt-4o-mini'),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  RAZORPAY_KEY_ID: z.string().default(''),
  RAZORPAY_KEY_SECRET: z.string().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().default(''),
  RAZORPAY_PLAN_BASIC: z.string().default(''),
  RAZORPAY_PLAN_PREMIUM: z.string().default(''),
  RAZORPAY_PLAN_SCALE: z.string().default(''),
  RAZORPAY_PLAN_ENTERPRISE: z.string().default(''),
  RAZORPAY_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  /** Monthly billing cycles sent to Razorpay when creating a subscription. */
  RAZORPAY_SUBSCRIPTION_TOTAL_COUNT: z.coerce.number().int().positive().default(120),
  WEBHOOK_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  MEDIA_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(3),
  SUPABASE_STORAGE_BUCKET: z.string().trim().min(1).default('message-media'),
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
