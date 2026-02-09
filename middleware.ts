import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const ALLOWED_EMAILS = [
  'schalk.vdmerwe@gmail.com',
  'vdmkelz@gmail.com',
]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Refresh session if it exists
  const { data: { user } } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  const isSharePage = /^\/trips\/[^/]+\/share/.test(request.nextUrl.pathname)
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth')
  const isOffline = request.nextUrl.pathname === '/_offline'

  // Allow public routes without authentication
  if (isSharePage || isLoginPage || isAuthCallback || isOffline) {
    return response
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // ALLOWLIST ENFORCEMENT
  // Users not on the allowlist are signed out and redirected
  if (!ALLOWED_EMAILS.includes(user.email?.toLowerCase() || '')) {
    await supabase.auth.signOut()
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - icons/ (app icons)
     * - manifest.json (PWA manifest)
     * - sw.js (service worker)
     * - workbox-* (workbox files)
     * - *.png (image files)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw\\.js|workbox-.*|.*\\.png$).*)'
  ],
}
