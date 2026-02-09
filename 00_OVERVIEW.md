# Holiday Planner App - Complete Project Specification

## Document Purpose

This specification provides everything needed to rebuild the Holiday Planner App from scratch. It was created after a data incident where improper sync logic caused data loss. This document captures all learnings, patterns, and requirements.

## Document Index

| File | Contents |
|------|----------|
| `00_OVERVIEW.md` | This file - project summary and document index |
| `01_ARCHITECTURE.md` | System architecture, tech stack, deployment |
| `02_DATABASE_SCHEMA.md` | Complete database schema with all tables, relationships, constraints |
| `03_API_SPECIFICATION.md` | All API endpoints, methods, payloads, responses |
| `04_COMPONENTS.md` | React component hierarchy, props, state management |
| `05_AUTHENTICATION.md` | Auth flows, RLS policies, security model |
| `06_AI_INTEGRATION.md` | Anthropic Claude integration, prompts, caching |
| `07_UI_UX_DESIGN.md` | Design system, responsive patterns, accessibility |
| `08_PWA_FEATURES.md` | Service worker, push notifications, offline support |
| `09_DATA_FLOWS.md` | How data moves through the system, sync logic |
| `10_LESSONS_LEARNED.md` | Critical mistakes to avoid, best practices |
| `11_REBUILD_PROMPT.md` | The exact prompt to give an AI to rebuild this app |
| `12_SUPABASE_SETUP.md` | Database setup, PITR, backups, RLS policies |

---

## Project Summary

**Name:** Holiday Planner App
**Purpose:** Family trip planning with AI-powered research, multi-version plan comparison, collaborative editing, and comprehensive cost tracking.

**Core Features:**
1. Trip creation with AI-generated itineraries
2. Multi-version planning (Plan A, B, C for comparison)
3. Day-by-day timeline with activities, drive times, locations
4. Accommodation, transport, and cost management
5. Booking checklist with payment tracking
6. AI research assistant for hotels, activities, restaurants
7. Collaborative sharing with family members
8. Traveller profiles with passport/ESTA tracking
9. Packing lists and document storage
10. PWA with offline support and push notifications

**Tech Stack:**
- Frontend: Next.js 14.1.0, React 18, TypeScript, Tailwind CSS
- Backend: Supabase (PostgreSQL + Auth + Storage)
- AI: Anthropic Claude (claude-sonnet-4-20250514)
- Maps: Leaflet
- Charts: Recharts
- Deployment: Vercel

**Users:**
- Primary: Family trip planners
- Collaboration: Shared with family members via email invite
- Access: Allowlist-based (specific emails only)

---

## Critical Requirements

### Data Integrity
1. **NEVER auto-delete user data** without explicit confirmation
2. **ALWAYS show preview** of changes before applying
3. **Checklist items are user-curated** - they may differ from source tables intentionally
4. **Enable Supabase PITR** (Point-in-Time Recovery) - see `12_SUPABASE_SETUP.md`

### Sync Logic Rules
1. Checklist is the **user's working document** - not a mirror of other tables
2. "Seed from Plan" should only ADD missing items, never delete
3. Any sync that modifies/deletes must show confirmation dialog first
4. Manual entries (no source_id) are sacred - never auto-delete

### Cost Calculations
1. Plan total = SUM of costs table (auto-calculated via trigger)
2. Checklist total = SUM of checklist_items.total_cost
3. These may differ intentionally (checklist may have extras)
4. Display both totals clearly, don't try to reconcile automatically

---

## Key Entities

| Entity | Description | Primary Table |
|--------|-------------|---------------|
| Trip | Container for a holiday | `trips` |
| Plan Version | One version of the itinerary (can have multiple) | `plan_versions` |
| Itinerary Day | Single day in the trip | `itinerary_days` |
| Accommodation | Hotel, resort, Airbnb, cruise cabin | `accommodations` |
| Transport | Car rental, flight, transfer | `transport` |
| Cost | Individual cost item | `costs` |
| Checklist Item | Booking/payment tracking item | `checklist_items` |
| Decision | Pending choice to make | `decisions` |
| Traveller | Person on the trip | `travellers` |
| Activity | Specific activity on a day | `activities` |

---

## User Workflows

### 1. Create New Trip
1. Enter destination, dates, traveller count
2. AI generates initial itinerary
3. User reviews and modifies
4. Trip saved with Plan A

### 2. Plan and Compare
1. Clone Plan A to create Plan B
2. Modify Plan B with alternatives
3. Use AI comparison to evaluate pros/cons
4. Set preferred plan as active

### 3. Book and Track
1. Use Checklist tab to track bookings
2. Mark items as booked/confirmed
3. Record deposits and payments
4. See remaining costs at a glance

### 4. Collaborate
1. Share trip with family member email
2. They can view or edit based on permission
3. Comments allow discussion on specific items

### 5. Prepare for Trip
1. Add traveller passport/ESTA info
2. Upload travel documents
3. Generate and check off packing list
4. Export trip summary for offline reference

---

## File Structure

```
/app
  /layout.tsx              # Root layout with metadata
  /page.tsx                # Dashboard (trip list)
  /login/page.tsx          # Auth page (Google OAuth + Magic Link)
  /_offline/page.tsx       # PWA offline fallback page
  /auth/callback/route.ts  # OAuth callback handler
  /map/page.tsx            # Standalone map view
  /trips
    /new/page.tsx          # Trip creation wizard
    /[id]/page.tsx         # Trip dashboard (main view with tabs)
    /[id]/accommodations/page.tsx  # Dedicated accommodations view
    /[id]/decisions/page.tsx       # Dedicated decisions view
    /[id]/research/page.tsx        # AI research page
    /[id]/compare/page.tsx         # Plan comparison page
    /[id]/share/page.tsx           # Public share view (no auth)
  /api
    /trips/...             # Trip CRUD + shares + export
    /plan-versions/...     # Plan version CRUD + clone
    /accommodations/...    # Accommodation CRUD
    /transport/...         # Transport CRUD (same pattern)
    /activities/...        # Activity CRUD
    /decisions/...         # Decision CRUD
    /travellers/...        # Traveller CRUD
    /travel-insurance/...  # Insurance CRUD
    /packing/...           # Packing list CRUD
    /documents/...         # Document upload/delete
    /comments/...          # Comments CRUD
    /ai/...                # AI endpoints (9 routes)
    /push/...              # Push notification subscribe/notify
    /weather/...           # External weather API
    /exchange-rate/...     # External currency API
/components
  /FloridaMap.tsx          # Sample map component
  /FloridaMapInner.tsx     # Leaflet implementation
  /trip/...                # 23 trip-specific components
/lib
  /supabase.ts             # Browser client + type exports
  /supabase-server.ts      # Server clients (4 types)
  /anthropic.ts            # AI functions (8 functions)
  /push-utils.ts           # Push notification utilities
  /database.types.ts       # Generated Supabase types
/public
  /manifest.json           # PWA manifest
  /icons/...               # App icons (72-512px)
  /sw.js                   # Service worker (generated)
/supabase
  /migrations/...          # Database migrations (8 files)
  /config.toml             # Local dev config
/middleware.ts             # Auth + allowlist enforcement
```

**Note:** Costs are managed via the costs table but there's no dedicated `/api/costs/` endpoint - costs are created/updated implicitly through plan operations or directly via Supabase client in components.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-09 | Initial specification created after data incident |

---

## Authors

- Original development: Claude (AI assistant)
- Specification: Claude Opus 4.5
- Project owner: User (schalk.vdmerwe@gmail.com)
