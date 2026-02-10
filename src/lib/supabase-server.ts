import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

/**
 * Route Handler Client - for use in API Routes and Server Actions
 * Uses the anon key, manages cookies for session handling, respects RLS
 */
export function createRouteHandlerClient() {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - cookies are read-only
          }
        }
      }
    }
  )
}

/**
 * Admin Client - for privileged server-side operations
 * Uses the service role key - BYPASSES RLS completely
 * Only use for operations that require elevated privileges:
 * - Auto-linking trip shares on auth callback
 * - Admin operations
 *
 * NEVER expose or use in client-side code
 */
export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
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
