# Database Schema - Complete Reference

## Overview

The database uses PostgreSQL via Supabase with 16 tables organized around trip planning. All tables use UUIDs as primary keys and have Row Level Security (RLS) enabled.

---

## Entity Relationship Diagram

```
                                    ┌─────────────────┐
                                    │   auth.users    │
                                    │   (Supabase)    │
                                    └────────┬────────┘
                                             │
                     ┌───────────────────────┼───────────────────────┐
                     │                       │                       │
                     ▼                       ▼                       ▼
           ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
           │ push_subscriptions│   │     trips       │    │  trip_shares    │
           └─────────────────┘    └────────┬────────┘    └─────────────────┘
                                           │
        ┌──────────────────────────────────┼──────────────────────────────────┐
        │              │           │       │       │           │              │
        ▼              ▼           ▼       ▼       ▼           ▼              ▼
┌──────────────┐ ┌──────────┐ ┌─────────┐ │ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│ plan_versions│ │travellers│ │decisions│ │ │ documents│ │packing_  │ │travel_       │
└──────┬───────┘ └──────────┘ └─────────┘ │ └──────────┘ │items     │ │insurance     │
       │                                   │              └──────────┘ └──────────────┘
       │                                   │
       │         ┌─────────────────────────┼─────────────────────────┐
       │         │           │             │             │           │
       ▼         ▼           ▼             ▼             ▼           ▼
┌──────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐
│itinerary_│ │accommod- │ │transport│ │  costs  │ │checklist_│ │ comments │
│days      │ │ations    │ │         │ │         │ │items     │ │          │
└────┬─────┘ └──────────┘ └─────────┘ └─────────┘ └──────────┘ └──────────┘
     │
     ▼
┌──────────┐
│activities│
└──────────┘
```

---

## Table Definitions

### trips

**Purpose:** Core trip container - one per holiday

```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Indexes
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);
CREATE INDEX idx_trips_public_share_token ON trips(public_share_token)
  WHERE public_share_token IS NOT NULL;

-- Trigger
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

### plan_versions

**Purpose:** Multiple versions of a trip for comparison (Plan A, B, C)

```sql
CREATE TABLE plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  total_cost DECIMAL(12,2) DEFAULT 0,
  currency TEXT DEFAULT 'GBP',
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plan_versions_trip_id ON plan_versions(trip_id);
-- Only one active plan per trip
CREATE UNIQUE INDEX idx_one_active_plan ON plan_versions(trip_id) WHERE is_active = true;

-- Trigger
CREATE TRIGGER update_plan_versions_updated_at
  BEFORE UPDATE ON plan_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Note:** `total_cost` is auto-calculated by trigger on `costs` table.

---

### itinerary_days

**Purpose:** Day-by-day breakdown of the trip

```sql
CREATE TABLE itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE,
  location TEXT NOT NULL,
  location_coordinates JSONB,  -- {lat: number, lng: number}
  icon TEXT DEFAULT '📍',
  color TEXT DEFAULT '#6b7280',
  activities JSONB DEFAULT '[]',  -- Legacy, use activities table
  notes TEXT,
  drive_time TEXT,      -- e.g., "~2 hrs"
  drive_distance TEXT,  -- e.g., "120 miles"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_version_id, day_number)
);

-- Indexes
CREATE INDEX idx_itinerary_days_plan ON itinerary_days(plan_version_id);
```

---

### accommodations

**Purpose:** Hotel, resort, villa, Airbnb, cruise bookings

```sql
CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'hotel',  -- hotel, resort, villa, airbnb, cruise
  location TEXT,
  address TEXT,
  coordinates JSONB,  -- {lat: number, lng: number}
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  nights INTEGER GENERATED ALWAYS AS (check_out - check_in) STORED,
  cost DECIMAL(10,2),
  currency TEXT DEFAULT 'GBP',
  booking_reference TEXT,
  booking_url TEXT,
  cancellation_policy TEXT,
  amenities JSONB DEFAULT '[]',  -- ["pool", "breakfast", "parking"]
  notes TEXT,
  color TEXT DEFAULT '#4ECDC4',
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_accommodations_plan ON accommodations(plan_version_id);
CREATE INDEX idx_accommodations_dates ON accommodations(check_in, check_out);
```

**Note:** `nights` is a computed column - automatically calculated from dates.

---

### transport

**Purpose:** Car rentals, flights, transfers, trains, ferries

```sql
CREATE TABLE transport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- car_rental, flight, transfer, train, ferry
  provider TEXT,       -- Hertz, British Airways, etc.
  vehicle TEXT,        -- Ford Expedition Max, Boeing 777
  reference_number TEXT,
  pickup_location TEXT,
  pickup_date DATE,
  pickup_time TIME,
  dropoff_location TEXT,
  dropoff_date DATE,
  dropoff_time TIME,
  cost DECIMAL(10,2),
  currency TEXT DEFAULT 'GBP',
  includes JSONB DEFAULT '[]',  -- ["unlimited_miles", "insurance"]
  booking_url TEXT,
  notes TEXT,
  is_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transport_plan ON transport(plan_version_id);
```

---

### costs

**Purpose:** Individual cost items for budgeting

```sql
CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  itinerary_day_id UUID REFERENCES itinerary_days(id) ON DELETE SET NULL,
  category TEXT NOT NULL,  -- accommodation, transport, activities, food, tickets, misc
  item TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'GBP',
  is_paid BOOLEAN DEFAULT false,
  is_estimated BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_costs_plan ON costs(plan_version_id);
CREATE INDEX idx_costs_category ON costs(category);

-- Auto-update plan total when costs change
CREATE OR REPLACE FUNCTION recalculate_plan_cost()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE plan_versions
  SET total_cost = (
    SELECT COALESCE(SUM(amount), 0) FROM costs
    WHERE plan_version_id = COALESCE(NEW.plan_version_id, OLD.plan_version_id)
  )
  WHERE id = COALESCE(NEW.plan_version_id, OLD.plan_version_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalc_cost_on_insert AFTER INSERT ON costs
  FOR EACH ROW EXECUTE FUNCTION recalculate_plan_cost();
CREATE TRIGGER recalc_cost_on_update AFTER UPDATE ON costs
  FOR EACH ROW EXECUTE FUNCTION recalculate_plan_cost();
CREATE TRIGGER recalc_cost_on_delete AFTER DELETE ON costs
  FOR EACH ROW EXECUTE FUNCTION recalculate_plan_cost();
```

---

### checklist_items

**Purpose:** Booking checklist with payment tracking

```sql
CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('accommodation', 'transport', 'activity', 'tickets', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT,  -- 'accommodation', 'transport', 'cost' (for linking)
  source_id UUID,    -- ID of source record (for duplicate detection)
  booking_status TEXT NOT NULL DEFAULT 'not_booked'
    CHECK (booking_status IN ('not_booked', 'booked', 'confirmed')),
  booking_reference TEXT,
  booking_url TEXT,
  total_cost NUMERIC(10,2) DEFAULT 0,
  deposit_amount NUMERIC(10,2) DEFAULT 0,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  is_fully_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_type TEXT NOT NULL DEFAULT 'full'
    CHECK (payment_type IN ('full', 'deposit', 'on_arrival', 'free')),
  payment_due_date DATE,
  payment_due_context TEXT DEFAULT 'flexible'
    CHECK (payment_due_context IN ('before_trip', 'on_arrival', 'flexible')),
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_checklist_items_plan_version ON checklist_items(plan_version_id);
CREATE INDEX idx_checklist_items_source ON checklist_items(plan_version_id, source_type, source_id);
```

**CRITICAL:** This table is user-curated. Items may differ from source tables intentionally. Never auto-delete without user confirmation.

---

### activities

**Purpose:** Detailed activities for each itinerary day

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id UUID NOT NULL REFERENCES plan_versions(id) ON DELETE CASCADE,
  itinerary_day_id UUID NOT NULL REFERENCES itinerary_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  time_start TEXT,
  time_end TEXT,
  location TEXT,
  cost NUMERIC(12,2),
  currency TEXT DEFAULT 'GBP',
  booking_status TEXT DEFAULT 'not_booked'
    CHECK (booking_status IN ('not_booked', 'booked', 'confirmed', 'cancelled')),
  booking_reference TEXT,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activities_day ON activities(itinerary_day_id, sort_order);
```

---

### decisions

**Purpose:** Track pending decisions that need to be made

```sql
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  options JSONB DEFAULT '[]',  -- [{name, cost, pros, cons}]
  selected_option INTEGER,     -- Index of chosen option
  due_date DATE,
  priority TEXT DEFAULT 'medium',  -- low, medium, high, urgent
  status TEXT DEFAULT 'pending',   -- pending, decided, deferred
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_decisions_trip ON decisions(trip_id);
CREATE INDEX idx_decisions_status ON decisions(status);
```

---

### travellers

**Purpose:** Traveller profiles with passport and dietary info

```sql
CREATE TABLE travellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  passport_number TEXT,
  passport_expiry DATE,
  nationality TEXT,
  esta_status TEXT DEFAULT 'not_required'
    CHECK (esta_status IN ('not_required', 'pending', 'approved', 'expired')),
  dietary TEXT,
  medical_notes TEXT,
  is_child BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### travel_insurance

**Purpose:** Travel insurance policy information

```sql
CREATE TABLE travel_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  policy_number TEXT,
  emergency_phone TEXT,
  coverage_start DATE,
  coverage_end DATE,
  document_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### documents

**Purpose:** File uploads for trip documentation

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  plan_version_id UUID REFERENCES plan_versions(id) ON DELETE SET NULL,
  linked_item_type TEXT,  -- 'accommodation', 'activity', etc.
  linked_item_id UUID,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);
```

---

### packing_items

**Purpose:** Packing list with assignment tracking

```sql
CREATE TABLE packing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'Misc',
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  packed BOOLEAN DEFAULT false,
  assigned_to TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### comments

**Purpose:** Item-level discussions for collaboration

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,  -- 'accommodation', 'activity', etc.
  item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

### trip_shares

**Purpose:** Share trips with family members

```sql
CREATE TABLE trip_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT DEFAULT 'view',  -- view, edit, admin
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  UNIQUE(trip_id, shared_with_email)
);

-- Indexes
CREATE INDEX idx_trip_shares_email ON trip_shares(shared_with_email);
CREATE INDEX idx_trip_shares_user ON trip_shares(shared_with_user_id);
```

---

### push_subscriptions

**Purpose:** Web Push API subscriptions for notifications

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, endpoint)
);

-- Indexes
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
```

---

### ai_research_cache

**Purpose:** Cached AI research results to avoid redundant API calls

```sql
CREATE TABLE ai_research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  query_type TEXT,  -- hotel_search, activity_search, comparison, suggestion
  results JSONB NOT NULL,
  model TEXT,
  tokens_used INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_cache_trip ON ai_research_cache(trip_id);
CREATE INDEX idx_ai_cache_query ON ai_research_cache(query);
```

---

## Common Utility Function

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Data Types Reference

| PostgreSQL Type | Usage | Examples |
|-----------------|-------|----------|
| UUID | All primary/foreign keys | id, user_id, trip_id |
| TEXT | Strings, labels | name, description, location |
| DATE | Date only (no time) | start_date, check_in |
| TIME | Time only | pickup_time, time_start |
| TIMESTAMPTZ | Timestamps with timezone | created_at, updated_at |
| DECIMAL(12,2) | Money fields | cost, amount, total_cost |
| NUMERIC(10,2) | Money fields (checklist) | total_cost, deposit_amount |
| BOOLEAN | Yes/no | is_archived, is_confirmed, packed |
| INTEGER | Counts, ordering | day_number, quantity, sort_order |
| JSONB | Complex nested data | coordinates, amenities, options |
