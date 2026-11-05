import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { loadEnv } from './config/index.js'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (client !== null) {
    return client
  }

  const env = loadEnv()
  if (env.SUPABASE_URL === undefined || env.SUPABASE_SERVICE_ROLE_KEY === undefined) {
    return null
  }

  client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}
