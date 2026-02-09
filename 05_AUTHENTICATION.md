# Authentication & Security

## Overview

The Holiday Planner App implements a multi-layered authentication system:

1. **OAuth (Google)** and **Email Magic Links (OTP)** for user authentication
2. **Server-side middleware** for access control
3. **Row-Level Security (RLS)** policies for database access
4. **Email-based allowlist** for access restriction

---

## Authentication Flow

```
User Visits App
        │
        ▼
┌─────────────────┐
│   Middleware    │
│ (middleware.ts) │
└────────┬────────┘
         │
         ├─── No session ──────────────────► Redirect to /login
         │
         ├─── Session but not in allowlist ─► Sign out & redirect to /login
         │
         └─── Valid session ────────────────► Allow request
                   │
                   ▼
        ┌─────────────────┐
        │   API Routes    │
        │ (createRoute    │
        │  HandlerClient) │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Database RLS   │
        │   Policies      │
        └─────────────────┘
```

---

## Middleware

**File:** `/middleware.ts`

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refresh session
  const { data: { user } } = await supabase.auth.getUser();

  // Public routes
  const isSharePage = /^\/trips\/[^/]+\/share/.test(request.nextUrl.pathname);
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isAuthCallback = request.nextUrl.pathname.startsWith('/auth');
  const isOffline = request.nextUrl.pathname === '/_offline';

  // Allow public routes
  if (isSharePage || isLoginPage || isAuthCallback || isOffline) {
    return response;
  }

  // Redirect unauthenticated users
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ALLOWLIST ENFORCEMENT
  const ALLOWED_EMAILS = [
    'schalk.vdmerwe@gmail.com',
    'vdmkelz@gmail.com',
  ];

  if (!ALLOWED_EMAILS.includes(user.email?.toLowerCase() || '')) {
    await supabase.auth.signOut();
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw\\.js|workbox-.*|.*\\.png$).*)'
  ],
};
```

**Key Features:**
- Refreshes session on every request
- Enforces allowlist at middleware level
- Signs out unauthorized users
- Allows public share pages without auth

---

## Login Page

**File:** `/app/login/page.tsx`

### Google OAuth

```typescript
async function handleGoogleSignIn() {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) setErrorMessage(error.message);
}
```

### Email Magic Link

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  // Client-side allowlist check (UX only, not security)
  if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
    setStatus('error');
    setErrorMessage('Access restricted. This app is invite-only.');
    return;
  }

  setStatus('loading');

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    setStatus('error');
    setErrorMessage(error.message);
  } else {
    setStatus('sent');
  }
}
```

---

## Auth Callback

**File:** `/app/auth/callback/route.ts`

```typescript
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options) {
            cookieStore.delete({ name, ...options });
          },
        },
      }
    );

    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Auto-link pending trip shares
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.email) {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await admin
          .from('trip_shares')
          .update({
            shared_with_user_id: user.id,
            accepted_at: new Date().toISOString(),
          })
          .eq('shared_with_email', user.email.toLowerCase())
          .is('shared_with_user_id', null);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

---

## Supabase Clients

**File:** `/lib/supabase-server.ts`

### Browser Client (Client Components)

```typescript
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createBrowserSupabaseClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Route Handler Client (API Routes - Respects RLS)

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createRouteHandlerClient() {
  const cookieStore = cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        }
      }
    }
  );
}
```

### Admin Client (Bypasses RLS)

```typescript
import { createClient } from '@supabase/supabase-js';

export function createAdminSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
```

---

## Row-Level Security (RLS)

### Helper Functions

```sql
-- Bypass RLS recursion with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_trip_shared_with_user(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_shares
    WHERE trip_shares.trip_id = p_trip_id
    AND trip_shares.shared_with_user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips
    WHERE trips.id = p_trip_id
    AND trips.user_id = p_user_id
  );
$$;
```

### Trips Table Policies

```sql
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- View own trips or shared trips
CREATE POLICY "trips_select" ON trips
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_trip_shared_with_user(id, auth.uid())
  );

-- Only owner can insert
CREATE POLICY "trips_insert" ON trips
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only owner can update
CREATE POLICY "trips_update" ON trips
  FOR UPDATE USING (auth.uid() = user_id);

-- Only owner can delete
CREATE POLICY "trips_delete" ON trips
  FOR DELETE USING (auth.uid() = user_id);
```

### Child Table Policies

```sql
-- Plan versions: owner or shared user
CREATE POLICY "plan_versions_all" ON plan_versions
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- Nested tables: check via parent
CREATE POLICY "itinerary_days_all" ON itinerary_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = itinerary_days.plan_version_id
      AND (is_trip_owner(pv.trip_id, auth.uid())
           OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
    )
  );

-- Similar policies for:
-- accommodations, transport, costs, decisions, activities, checklist_items
```

### Trip Shares Policies

```sql
-- Owner can manage all shares
CREATE POLICY "trip_shares_owner" ON trip_shares
  FOR ALL USING (is_trip_owner(trip_id, auth.uid()));

-- Shared user can view their own shares
CREATE POLICY "trip_shares_viewer" ON trip_shares
  FOR SELECT USING (shared_with_user_id = auth.uid());
```

---

## Allowlist Implementation

**Three-Level Enforcement:**

### Level 1: Client-Side (UX Feedback)

```typescript
// app/login/page.tsx
const ALLOWED_EMAILS = ['schalk.vdmerwe@gmail.com', 'vdmkelz@gmail.com'];

if (!ALLOWED_EMAILS.includes(email.toLowerCase().trim())) {
  setStatus('error');
  setErrorMessage('Access restricted. This app is invite-only.');
  return;
}
```

### Level 2: Middleware (Server-Side)

```typescript
// middleware.ts
const ALLOWED_EMAILS = ['schalk.vdmerwe@gmail.com', 'vdmkelz@gmail.com'];

if (user && !ALLOWED_EMAILS.includes(user.email?.toLowerCase() || '')) {
  await supabase.auth.signOut();
  return NextResponse.redirect(loginUrl);
}
```

### Level 3: API Routes (Sharing)

```typescript
// app/api/trips/[id]/shares/route.ts
const ALLOWED_EMAILS = ['schalk.vdmerwe@gmail.com', 'vdmkelz@gmail.com'];

if (!ALLOWED_EMAILS.includes(email.toLowerCase())) {
  return NextResponse.json(
    { error: 'Can only share with approved users' },
    { status: 403 }
  );
}
```

---

## Session Management

### Configuration

```toml
# supabase/config.toml
[auth]
site_url = "http://127.0.0.1:3000"
jwt_expiry = 3600  # 1 hour
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
enable_confirmations = false  # Auto-confirm
otp_length = 6
otp_expiry = 3600  # 1 hour
```

### Sign Out

```typescript
async function handleSignOut() {
  const supabase = createBrowserSupabaseClient();
  await supabase.auth.signOut();
  router.push('/login');
}
```

---

## Security Best Practices

### Environment Variables

```bash
# Public (exposed to client)
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-side only (NEVER expose)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Security Checklist

- [ ] Allowlist enforced at middleware level
- [ ] RLS enabled on all tables
- [ ] Service role key only used server-side
- [ ] Sessions stored in HTTPOnly cookies
- [ ] OAuth redirect URLs whitelisted in Supabase
- [ ] VAPID keys for push notifications (if used)

---

## Permission Levels

| Permission | View | Edit | Delete | Manage Shares |
|------------|------|------|--------|---------------|
| Owner      | Yes  | Yes  | Yes    | Yes           |
| Admin      | Yes  | Yes  | No     | Yes           |
| Edit       | Yes  | Yes  | No     | No            |
| View       | Yes  | No   | No     | No            |

---

## Adding New Users

To add a new user to the allowlist:

1. Add email to `ALLOWED_EMAILS` array in:
   - `/app/login/page.tsx`
   - `/middleware.ts`
   - `/app/api/trips/[id]/shares/route.ts`

2. Redeploy the application

3. User can now sign in via Google or Magic Link
