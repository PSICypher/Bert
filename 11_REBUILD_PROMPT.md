# Rebuild Prompt

This document contains the exact prompt to give an AI assistant to rebuild the Holiday Planner App from scratch.

---

## The Prompt

```markdown
# Holiday Planner App - Complete Rebuild

## Project Overview

Build a family trip planning web application with the following features:

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

## Tech Stack

- **Frontend:** Next.js 14.1.0 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **AI:** Anthropic Claude (claude-sonnet-4-20250514)
- **Maps:** Leaflet with OpenStreetMap
- **Charts:** Recharts
- **Deployment:** Vercel

## Critical Requirements

### RULE 1: Never Auto-Delete User Data

Every delete operation MUST show a confirmation dialog listing exactly what will be deleted. No exceptions.

```typescript
// BAD - Never do this
await supabase.from('table').delete().in('id', ids);

// GOOD - Always confirm first
const confirmed = await showConfirmDialog({
  title: 'Delete items?',
  message: `${ids.length} items will be permanently deleted`,
  items: itemsToDelete.map(i => i.name)
});
if (confirmed) {
  await supabase.from('table').delete().in('id', ids);
}
```

### RULE 2: Checklist Is User-Curated

The checklist_items table is NOT a mirror of accommodations/transport/costs. It's a separate document where users track bookings and payments.

Key points:
- Items WITH source_id are linked to source tables
- Items WITHOUT source_id are manual entries (sacred, never auto-delete)
- Checklist total may differ from plan total intentionally
- "Seed from Plan" only ADDS items, never deletes

### RULE 3: Preview All Changes

Before any bulk operation, show a preview:

```typescript
const preview = {
  toAdd: [...],    // Green
  toUpdate: [...], // Yellow
  toRemove: [...], // Red - requires explicit checkbox
};

const approved = await showPreviewDialog(preview);
if (approved) {
  await applyChanges(preview);
}
```

### RULE 4: Enable PITR

On Supabase Pro plan ($25/month), enable Point-in-Time Recovery:
- Go to Project Settings → Database
- Enable PITR
- Allows recovery to any point in last 7 days

## Database Schema

### Core Tables

```sql
-- Trips (top level)
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  cover_image_url TEXT,
  is_archived BOOLEAN DEFAULT false,
  public_share_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan Versions (multiple per trip)
CREATE TABLE plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Plan A',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  total_cost DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'GBP',
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Itinerary Days
CREATE TABLE itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL,
  date DATE,
  location TEXT NOT NULL,
  location_coordinates JSONB,
  icon TEXT DEFAULT '📍',
  color TEXT DEFAULT '#8B5CF6',
  activities JSONB DEFAULT '[]',
  notes TEXT,
  drive_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accommodations
CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'hotel',
  location TEXT,
  address TEXT,
  coordinates JSONB,
  check_in DATE,
  check_out DATE,
  nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
  cost DECIMAL(10,2),
  currency TEXT DEFAULT 'GBP',
  booking_reference TEXT,
  booking_url TEXT,
  cancellation_policy TEXT,
  amenities JSONB DEFAULT '[]',
  notes TEXT,
  color TEXT,
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transport
CREATE TABLE transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  provider TEXT,
  vehicle TEXT,
  pickup_location TEXT,
  pickup_date DATE,
  pickup_time TEXT,
  dropoff_location TEXT,
  dropoff_date DATE,
  dropoff_time TEXT,
  cost DECIMAL(10,2),
  currency TEXT DEFAULT 'GBP',
  booking_reference TEXT,
  booking_url TEXT,
  notes TEXT,
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Costs
CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  is_paid BOOLEAN DEFAULT false,
  is_estimated BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checklist Items (USER-CURATED, separate from source tables)
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE CASCADE NOT NULL,
  -- Source linking (NULL for manual entries)
  source_type TEXT, -- 'accommodation', 'transport', 'cost'
  source_id UUID,
  -- Display
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  -- Costs
  total_cost DECIMAL(10,2) DEFAULT 0,
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  payment_type TEXT DEFAULT 'full', -- 'full', 'deposit', 'on_arrival', 'free'
  payment_due_date DATE,
  payment_due_context TEXT,
  -- Status
  booking_status TEXT DEFAULT 'not_booked', -- 'not_booked', 'booked', 'confirmed'
  booking_reference TEXT,
  booking_url TEXT,
  -- Notes
  description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Supporting Tables

```sql
-- Activities (per day)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE CASCADE,
  itinerary_day_id UUID REFERENCES itinerary_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  time_start TEXT,
  time_end TEXT,
  location TEXT,
  cost DECIMAL(10,2),
  notes TEXT,
  booking_status TEXT DEFAULT 'not_booked',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Decisions
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  options JSONB DEFAULT '[]',
  selected_option INTEGER,
  due_date DATE,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Shares
CREATE TABLE trip_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES auth.users(id),
  permission TEXT NOT NULL DEFAULT 'view',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trip_id, shared_with_email)
);

-- Travellers
CREATE TABLE travellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  passport_number TEXT,
  passport_expiry DATE,
  nationality TEXT,
  esta_status TEXT,
  dietary TEXT,
  medical_notes TEXT,
  is_child BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Packing Items
CREATE TABLE packing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  packed BOOLEAN DEFAULT false,
  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  linked_item_type TEXT,
  linked_item_id UUID,
  notes TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Travel Insurance
CREATE TABLE travel_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  policy_number TEXT,
  emergency_phone TEXT,
  coverage_start DATE,
  coverage_end DATE,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Research Cache
CREATE TABLE ai_research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id),
  query TEXT NOT NULL,
  query_type TEXT,
  results JSONB NOT NULL,
  model TEXT,
  tokens_used INTEGER,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push Subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Row-Level Security

Enable RLS on all tables and create policies using security-definer helper functions to avoid recursion:

```sql
-- Helper functions
CREATE OR REPLACE FUNCTION public.is_trip_owner(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM trips WHERE id = p_trip_id AND user_id = p_user_id); $$;

CREATE OR REPLACE FUNCTION public.is_trip_shared_with_user(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM trip_shares WHERE trip_id = p_trip_id AND shared_with_user_id = p_user_id); $$;

-- Example policies
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trips_select" ON trips FOR SELECT USING (
  auth.uid() = user_id OR is_trip_shared_with_user(id, auth.uid())
);

CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trips_delete" ON trips FOR DELETE USING (auth.uid() = user_id);
```

## Authentication

1. Use Supabase Auth with Google OAuth and Email Magic Links
2. Implement email allowlist at middleware level
3. Enforce allowlist on every request
4. Auto-link pending shares when user signs in

## AI Integration

Use Anthropic Claude (claude-sonnet-4-20250514) for:
- Trip plan generation
- Research (hotels, activities, restaurants)
- Plan comparison
- Cost optimization
- Itinerary suggestions
- Web content extraction
- Packing list generation

Cache AI responses in ai_research_cache table with appropriate expiry times.

## File Structure

```
/app
  /layout.tsx
  /page.tsx (Dashboard)
  /login/page.tsx
  /auth/callback/route.ts
  /_offline/page.tsx
  /trips
    /new/page.tsx
    /[id]/page.tsx
    /[id]/share/page.tsx
  /api
    /trips/...
    /plan-versions/...
    /accommodations/...
    /transport/...
    /costs/...
    /activities/...
    /checklist-items/...
    /decisions/...
    /travellers/...
    /packing/...
    /documents/...
    /comments/...
    /travel-insurance/...
    /weather/...
    /exchange-rate/...
    /ai/...
    /push/...
/components
  /trip/... (all trip-related components)
  /ui/... (shared UI components)
/lib
  /supabase.ts
  /supabase-server.ts
  /anthropic.ts
  /push-utils.ts
  /database.types.ts
/public
  /manifest.json
  /icons/...
```

## Key Components

Build these React components:
1. TripHeader - Trip title, dates, share, export
2. TripDashboardHeader - Metrics display
3. PlanVersionTabs - Plan selection and management
4. DayCardGrid - Day-by-day view
5. BookingChecklist - Payment tracking (CRITICAL: follow rules above)
6. ResearchChat - AI research assistant
7. AiInsights - Suggestions, comparison, optimization
8. ChangeSheet - Modal for editing items
9. TripMap - Leaflet map with route
10. CostBreakdown - Charts and visualizations

## Environment Variables

```bash
# Required - Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Public anon key

# Required - Server secrets (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Bypasses RLS
ANTHROPIC_API_KEY=sk-ant-api03-...  # Claude API

# Required for push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BM...  # Generate with: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=...  # Private key from same command
VAPID_SUBJECT=mailto:your-email@example.com

# Optional - Monitoring
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=
SENTRY_DSN=
```

## Important Implementation Notes

1. **No dedicated /api/costs/ endpoint exists** - Costs are managed via direct Supabase client calls in components. The `plan_versions.total_cost` is auto-updated by database trigger.

2. **Checklist items have NO REST API** - The BookingChecklist component uses direct Supabase client calls. If building REST endpoints, ensure they NEVER auto-delete manual entries.

3. **Push notifications require VAPID keys** - Generate them before deployment or push features will fail silently.

## Testing Checklist

Before deploying, verify:
- [ ] All delete operations show confirmation
- [ ] Seed from Plan only adds, never deletes
- [ ] Manual checklist items preserved during sync
- [ ] RLS policies work correctly
- [ ] Auth flow works (Google + Magic Link)
- [ ] AI endpoints return structured data
- [ ] Push notifications work
- [ ] PWA installs correctly
- [ ] Offline page displays when offline
```

---

## Usage

Copy the entire prompt above and paste it into a new Claude conversation when you need to rebuild the application. The AI assistant will have complete context about:

1. All features and requirements
2. Database schema
3. Security model
4. Critical rules to follow
5. File structure
6. Key components

Remember to also provide:
- This PROJECT_SPEC folder for detailed reference
- Access to the Supabase project
- Environment variables
