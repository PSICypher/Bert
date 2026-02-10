import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Browser Client - for use in Client Components
 * Uses the anon key and respects RLS policies based on user session
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Allowlist of authorized emails
 * Add users here to grant them access to the app
 */
export const ALLOWED_EMAILS = [
  'schalk.vdmerwe@gmail.com',
  'vdmkelz@gmail.com',
]
