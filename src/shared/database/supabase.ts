import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { loadEnv } from '../config/index.js'

let supabaseAdminClient: SupabaseClient | null = null
let supabaseAuthClient: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  return getSupabaseAdminClient()
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdminClient !== null) {
    return supabaseAdminClient
  }

  const env = loadEnv()
  supabaseAdminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseAdminClient
}

export function getSupabaseAuthClient(): SupabaseClient {
  if (supabaseAuthClient !== null) {
    return supabaseAuthClient
  }

  const env = loadEnv()
  supabaseAuthClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabaseAuthClient
}

export async function checkDatabaseConnection(): Promise<boolean> {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('organizations').select('id').limit(1)
  return error === null
}
