import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Get the authenticated user
      const { data: { user } } = await supabase.auth.getUser()

      if (user?.email) {
        // Auto-link pending trip shares to this user
        // Using admin client to bypass RLS for this operation
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Find trip shares that were invited by email but not yet linked
        // to a user account, and link them to this user
        await admin
          .from('trip_shares')
          .update({
            shared_with_user_id: user.id,
            accepted_at: new Date().toISOString(),
          })
          .eq('shared_with_email', user.email.toLowerCase())
          .is('shared_with_user_id', null)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Auth failed - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
