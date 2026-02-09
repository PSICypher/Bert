# Architecture & Tech Stack

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Next.js 14 App Router                    ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ ││
│  │  │ React 18    │  │ Tailwind    │  │ Service Worker (PWA)│ ││
│  │  │ Components  │  │ CSS         │  │ + Push Notifications│ ││
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL EDGE                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Middleware (Auth Check)                   ││
│  │              Allowlist enforcement, session check            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VERCEL SERVERLESS                           │
│  ┌──────────────────────┐  ┌──────────────────────────────────┐ │
│  │   API Routes         │  │   Server Components              │ │
│  │   /api/*             │  │   SSR Pages                      │ │
│  └──────────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                │                              │
                │                              │
                ▼                              ▼
┌───────────────────────────┐  ┌───────────────────────────────────┐
│      SUPABASE             │  │        EXTERNAL APIs              │
│  ┌─────────────────────┐  │  │  ┌────────────────────────────┐  │
│  │ PostgreSQL Database │  │  │  │ Anthropic Claude API       │  │
│  │ + Row Level Security│  │  │  │ (AI research, generation)  │  │
│  └─────────────────────┘  │  │  └────────────────────────────┘  │
│  ┌─────────────────────┐  │  │  ┌────────────────────────────┐  │
│  │ Supabase Auth       │  │  │  │ Open-Meteo (weather)       │  │
│  │ (Magic Link + OAuth)│  │  │  │ Frankfurter (currency)     │  │
│  └─────────────────────┘  │  │  └────────────────────────────┘  │
│  ┌─────────────────────┐  │  └───────────────────────────────────┘
│  │ Supabase Storage    │  │
│  │ (Documents bucket)  │  │
│  └─────────────────────┘  │
└───────────────────────────┘
```

---

## Tech Stack Details

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.1.0 | React framework with App Router |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| Lucide React | Latest | Icon library |
| Recharts | Latest | Charts and graphs |
| Leaflet | Latest | Interactive maps |
| next-pwa | Latest | PWA support |

### Backend

| Technology | Purpose |
|------------|---------|
| Supabase | Database, Auth, Storage |
| PostgreSQL | Relational database |
| Vercel Serverless | API routes and SSR |

### AI

| Service | Model | Purpose |
|---------|-------|---------|
| Anthropic | claude-sonnet-4-20250514 | Research, plan generation, comparison |

### External APIs

| API | Auth Required | Purpose |
|-----|---------------|---------|
| Open-Meteo | No | Weather forecasts |
| Frankfurter | No | Currency exchange rates |
| Google OAuth | Yes (OAuth app) | Social login |

---

## Deployment Architecture

### Vercel Configuration

```javascript
// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  skipWaiting: true,
  fallbacks: {
    document: '/_offline',
  },
});

module.exports = withPWA({
  experimental: {
    serverActions: true,
  },
  images: {
    domains: ['images.unsplash.com', 'maps.googleapis.com'],
  },
});
```

### Environment Variables

```bash
# Public (exposed to client - safe to include in client bundle)
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BM...  # Required for push notifications

# Server-side only (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Bypasses RLS - KEEP SECRET
ANTHROPIC_API_KEY=sk-ant-api03-...  # AI API key - KEEP SECRET
VAPID_PRIVATE_KEY=...              # Push notification signing - KEEP SECRET
VAPID_SUBJECT=mailto:admin@example.com  # Contact for push service

# Optional (monitoring)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=
SENTRY_DSN=
```

**Required for Full Functionality:**
- Supabase keys: Core database/auth
- Anthropic key: AI features
- VAPID keys: Push notifications (can be omitted if push not needed)

### Vercel Project Settings

- **Framework Preset:** Next.js
- **Build Command:** `next build`
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Node.js Version:** 18.x

---

## Request Flow

### Authenticated Request

```
1. Browser sends request to Vercel
2. Middleware checks:
   - Is user authenticated? (Supabase session cookie)
   - Is email in allowlist?
   - If no → redirect to /login
3. Request reaches API route or page
4. Supabase client created with user's session
5. RLS policies enforce access control
6. Data returned to client
```

### Public Share Request

```
1. Browser requests /trips/[id]/share?token=[token]
2. Middleware allows (no auth check for share pages)
3. Page fetches trip using public_share_token
4. Read-only view rendered
```

### AI Request

```
1. Client calls /api/ai/research
2. Server checks AI cache for existing result
3. If cached and valid → return cached
4. Otherwise:
   - Call Anthropic API with structured prompt
   - Parse response into suggestions
   - Cache result in ai_research_cache
   - Return to client
```

---

## Caching Strategy

### Client-Side

| Resource | Cache Duration | Strategy |
|----------|----------------|----------|
| Static assets | 30 days | Cache First |
| API responses | 7 days | Network First |
| Page navigations | 24 hours | Network First |
| Images | 30 days | Cache First |
| Fonts | 1 year | Cache First |

### Server-Side

| Data | Cache Location | Duration |
|------|----------------|----------|
| AI research results | ai_research_cache table | 24 hours |
| Weather | In-memory (fetch) | 1 hour |
| Exchange rates | In-memory (fetch) | 24 hours |

---

## Error Handling

### Client Errors

```typescript
// Pattern used throughout
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error('Operation failed:', error);
  // Show user-friendly error toast
  toast.error('Failed to load data. Please try again.');
}
```

### Server Errors

```typescript
// API route pattern
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient();
    const { data, error } = await supabase.from('table').select();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

## Performance Considerations

### Database

1. **Indexes** on all foreign keys and frequently queried columns
2. **RLS policies** use security-definer functions to prevent recursion
3. **Computed columns** (e.g., `nights`) calculated at DB level
4. **Triggers** for auto-updating `total_cost` and `updated_at`

### Frontend

1. **Dynamic imports** for heavy components (maps, charts)
2. **Server components** where possible (no client JS)
3. **Skeleton loaders** for perceived performance
4. **Image optimization** via Next.js Image component

### API

1. **Parallel requests** where data is independent
2. **Caching** for AI responses and external APIs
3. **Pagination** for large lists (not currently implemented but recommended)

---

## Scaling Considerations

### Current Limits

- Supabase free tier: 500MB database, 1GB storage
- Vercel free tier: 100GB bandwidth/month
- Anthropic: Per-token billing

### Scaling Path

1. **Database:** Upgrade Supabase plan for PITR and larger storage
2. **API:** Add Redis caching layer if AI calls increase
3. **CDN:** Already handled by Vercel edge network
4. **Realtime:** Supabase Realtime for collaborative editing (not yet implemented)

---

## Monitoring & Observability

### Recommended Setup

```bash
# Optional environment variables
SENTRY_DSN=                    # Error tracking
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=  # Usage analytics
```

### Logging Pattern

```typescript
// Server-side logging
console.log('[API] Request to /api/trips', { userId, method });
console.error('[API] Database error', { error, query });

// Client-side logging (production)
if (process.env.NODE_ENV === 'production') {
  Sentry.captureException(error);
}
```
