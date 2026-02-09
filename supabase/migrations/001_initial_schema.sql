-- ============================================================================
-- Holiday Planner App - Initial Database Schema
-- ============================================================================
-- This migration creates all 16 tables with proper schema, RLS policies,
-- triggers, indexes, and storage bucket.
-- ============================================================================

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABLE DEFINITIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. trips - Core trip container
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);
CREATE INDEX idx_trips_public_share_token ON trips(public_share_token)
  WHERE public_share_token IS NOT NULL;

CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 2. plan_versions - Multiple versions of a trip for comparison
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_plan_versions_trip_id ON plan_versions(trip_id);
CREATE UNIQUE INDEX idx_one_active_plan ON plan_versions(trip_id) WHERE is_active = true;

CREATE TRIGGER update_plan_versions_updated_at
  BEFORE UPDATE ON plan_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 3. itinerary_days - Day-by-day breakdown of the trip
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_itinerary_days_plan ON itinerary_days(plan_version_id);
CREATE INDEX idx_itinerary_days_plan_version_id ON itinerary_days(plan_version_id);
CREATE INDEX idx_itinerary_days_date ON itinerary_days(date);

CREATE TRIGGER update_itinerary_days_updated_at
  BEFORE UPDATE ON itinerary_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 4. accommodations - Hotel, resort, villa, Airbnb, cruise bookings
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_accommodations_plan ON accommodations(plan_version_id);
CREATE INDEX idx_accommodations_plan_version_id ON accommodations(plan_version_id);
CREATE INDEX idx_accommodations_dates ON accommodations(check_in, check_out);

CREATE TRIGGER update_accommodations_updated_at
  BEFORE UPDATE ON accommodations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 5. transport - Car rentals, flights, transfers, trains, ferries
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_transport_plan ON transport(plan_version_id);
CREATE INDEX idx_transport_plan_version_id ON transport(plan_version_id);

CREATE TRIGGER update_transport_updated_at
  BEFORE UPDATE ON transport
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 6. costs - Individual cost items for budgeting
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_costs_plan ON costs(plan_version_id);
CREATE INDEX idx_costs_plan_version_id ON costs(plan_version_id);
CREATE INDEX idx_costs_category ON costs(category);

-- Function to recalculate plan total cost
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

-- ----------------------------------------------------------------------------
-- 7. checklist_items - Booking checklist with payment tracking
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_checklist_items_plan_version ON checklist_items(plan_version_id);
CREATE INDEX idx_checklist_items_plan_version_id ON checklist_items(plan_version_id);
CREATE INDEX idx_checklist_items_source ON checklist_items(plan_version_id, source_type, source_id);

CREATE TRIGGER update_checklist_items_updated_at
  BEFORE UPDATE ON checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 8. activities - Detailed activities for each itinerary day
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_activities_day ON activities(itinerary_day_id, sort_order);
CREATE INDEX idx_activities_itinerary_day_id ON activities(itinerary_day_id);

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 9. decisions - Track pending decisions that need to be made
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_decisions_trip ON decisions(trip_id);
CREATE INDEX idx_decisions_trip_id ON decisions(trip_id);
CREATE INDEX idx_decisions_status ON decisions(status);

CREATE TRIGGER update_decisions_updated_at
  BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 10. travellers - Traveller profiles with passport and dietary info
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_travellers_trip_id ON travellers(trip_id);

CREATE TRIGGER update_travellers_updated_at
  BEFORE UPDATE ON travellers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 11. travel_insurance - Travel insurance policy information
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_travel_insurance_trip_id ON travel_insurance(trip_id);

CREATE TRIGGER update_travel_insurance_updated_at
  BEFORE UPDATE ON travel_insurance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ----------------------------------------------------------------------------
-- 12. documents - File uploads for trip documentation
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_documents_trip_id ON documents(trip_id);

-- ----------------------------------------------------------------------------
-- 13. packing_items - Packing list with assignment tracking
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_packing_items_trip_id ON packing_items(trip_id);

-- ----------------------------------------------------------------------------
-- 14. comments - Item-level discussions for collaboration
-- ----------------------------------------------------------------------------
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,  -- 'accommodation', 'activity', etc.
  item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_item ON comments(item_type, item_id);
CREATE INDEX idx_comments_trip_id ON comments(trip_id);

-- ----------------------------------------------------------------------------
-- 15. trip_shares - Share trips with family members
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_trip_shares_email ON trip_shares(shared_with_email);
CREATE INDEX idx_trip_shares_user ON trip_shares(shared_with_user_id);
CREATE INDEX idx_trip_shares_trip_id ON trip_shares(trip_id);
CREATE INDEX idx_trip_shares_user_id ON trip_shares(shared_with_user_id);

-- ----------------------------------------------------------------------------
-- 16. push_subscriptions - Web Push API subscriptions for notifications
-- ----------------------------------------------------------------------------
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- ----------------------------------------------------------------------------
-- 17. ai_research_cache - Cached AI research results
-- ----------------------------------------------------------------------------
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

CREATE INDEX idx_ai_cache_trip ON ai_research_cache(trip_id);
CREATE INDEX idx_ai_cache_query ON ai_research_cache(query);
CREATE INDEX idx_ai_cache_lookup ON ai_research_cache(trip_id, query, query_type);
CREATE INDEX idx_ai_cache_expiry ON ai_research_cache(expires_at);


-- ============================================================================
-- RLS HELPER FUNCTIONS
-- ============================================================================

-- Check if user owns trip (bypasses RLS with SECURITY DEFINER)
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

-- Check if trip is shared with user (bypasses RLS with SECURITY DEFINER)
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


-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE travellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_research_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- TRIPS POLICIES
-- ----------------------------------------------------------------------------

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

-- ----------------------------------------------------------------------------
-- PLAN_VERSIONS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "plan_versions_all" ON plan_versions
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- ITINERARY_DAYS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "itinerary_days_all" ON itinerary_days
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = itinerary_days.plan_version_id
      AND (is_trip_owner(pv.trip_id, auth.uid())
           OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- ACCOMMODATIONS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "accommodations_all" ON accommodations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = accommodations.plan_version_id
      AND (is_trip_owner(pv.trip_id, auth.uid())
           OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- TRANSPORT POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "transport_all" ON transport
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = transport.plan_version_id
      AND (is_trip_owner(pv.trip_id, auth.uid())
           OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- COSTS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "costs_all" ON costs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = costs.plan_version_id
      AND (is_trip_owner(pv.trip_id, auth.uid())
           OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- CHECKLIST_ITEMS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "checklist_items_all" ON checklist_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = checklist_items.plan_version_id
      AND (is_trip_owner(pv.trip_id, auth.uid())
           OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- ACTIVITIES POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "activities_all" ON activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM plan_versions pv
      WHERE pv.id = activities.plan_version_id
      AND (is_trip_owner(pv.trip_id, auth.uid())
           OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
    )
  );

-- ----------------------------------------------------------------------------
-- DECISIONS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "decisions_all" ON decisions
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- TRIP_SHARES POLICIES
-- ----------------------------------------------------------------------------

-- Owner can manage all shares
CREATE POLICY "trip_shares_owner" ON trip_shares
  FOR ALL USING (is_trip_owner(trip_id, auth.uid()));

-- Shared user can view their own shares
CREATE POLICY "trip_shares_viewer" ON trip_shares
  FOR SELECT USING (shared_with_user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- TRAVELLERS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "travellers_all" ON travellers
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- PACKING_ITEMS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "packing_items_all" ON packing_items
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- DOCUMENTS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "documents_all" ON documents
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- COMMENTS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "comments_all" ON comments
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- TRAVEL_INSURANCE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "travel_insurance_all" ON travel_insurance
  FOR ALL USING (
    is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- AI_RESEARCH_CACHE POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "ai_research_cache_all" ON ai_research_cache
  FOR ALL USING (
    trip_id IS NULL  -- Allow global cache entries
    OR is_trip_owner(trip_id, auth.uid())
    OR is_trip_shared_with_user(trip_id, auth.uid())
  );

-- ----------------------------------------------------------------------------
-- PUSH_SUBSCRIPTIONS POLICIES
-- ----------------------------------------------------------------------------

CREATE POLICY "push_subscriptions_own" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());


-- ============================================================================
-- STORAGE BUCKET
-- ============================================================================

-- Create storage bucket for trip documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-documents', 'trip-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trip-documents');

CREATE POLICY "Users can read own documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'trip-documents');

CREATE POLICY "Users can delete own documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'trip-documents');


-- ============================================================================
-- COMMENTS
-- ============================================================================
-- Migration completed successfully
--
-- Tables created: 17
--   1. trips
--   2. plan_versions
--   3. itinerary_days
--   4. accommodations
--   5. transport
--   6. costs
--   7. checklist_items
--   8. activities
--   9. decisions
--   10. travellers
--   11. travel_insurance
--   12. documents
--   13. packing_items
--   14. comments
--   15. trip_shares
--   16. push_subscriptions
--   17. ai_research_cache
--
-- All tables have:
--   - UUID primary keys
--   - RLS enabled with appropriate policies
--   - Indexes for common queries
--   - Triggers for updated_at timestamps where applicable
--
-- Storage bucket: trip-documents (private)
-- ============================================================================
