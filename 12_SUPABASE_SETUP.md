# Supabase Setup

## Project Configuration

### Creating the Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region closest to users (EU West for UK)
4. Set a strong database password
5. Save the password securely

### Environment Variables

After project creation, get these values:

```bash
# From Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # anon/public key

# From Project Settings → API → service_role (KEEP SECRET)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Point-in-Time Recovery (PITR)

### Why PITR Is Critical

PITR allows you to recover the database to any point in the last 7 days. This is essential for:

- Recovering from accidental data deletion
- Rolling back bad migrations
- Recovering from sync logic mistakes

### Enabling PITR

**Requirements:**
- Supabase Pro plan ($25/month minimum)
- Database must be on a dedicated instance

**Steps:**

1. Go to **Project Settings** → **Database**
2. Find the **Point-in-Time Recovery** section
3. Click **Enable PITR**
4. Confirm the upgrade if on Free tier
5. PITR will be active within a few minutes

### Using PITR

**To recover data:**

1. Go to **Database** → **Backups**
2. Select **Point-in-Time Recovery**
3. Choose the recovery point (before the incident)
4. Options:
   - **Restore to new database:** Safe, doesn't affect production
   - **Restore to current database:** Overwrites current data

**Recommended recovery process:**

1. Restore to a NEW database instance
2. Export the needed data from restored database
3. Carefully merge back into production
4. Delete the temporary restored database

---

## Backups

### Automated Backups

Supabase automatically creates daily backups on Pro plan.

**Retention:**
- Free tier: No backups
- Pro tier: 7 days
- Team tier: 30 days

### Manual Backups

**Export via SQL:**

```sql
-- Run in SQL Editor
COPY (SELECT * FROM trips) TO '/tmp/trips_backup.csv' WITH CSV HEADER;
```

**Export via pg_dump (requires database connection string):**

```bash
pg_dump "postgres://postgres:[password]@db.[ref].supabase.co:5432/postgres" > backup.sql
```

**Export from Dashboard:**

1. Go to **Database** → **Backups**
2. Click **Download** on any backup

---

## Database Configuration

### Run Migrations

After creating the project, run these migrations in order:

**001_initial_schema.sql:**
- All table definitions
- Initial indexes
- RLS policies

**002_fix_rls_recursion.sql:**
- Helper functions for RLS
- Updated policies using SECURITY DEFINER

**Run via SQL Editor** or **Supabase CLI:**

```bash
supabase db push
```

---

## Row-Level Security (RLS)

### Enable RLS on All Tables

```sql
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
```

### Helper Functions

These functions bypass RLS to avoid recursion:

```sql
-- Check if user owns trip
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

-- Check if trip is shared with user
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
```

### Policy Patterns

**Trips:**
```sql
CREATE POLICY "trips_select" ON trips FOR SELECT USING (
  auth.uid() = user_id OR is_trip_shared_with_user(id, auth.uid())
);
CREATE POLICY "trips_insert" ON trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trips_update" ON trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trips_delete" ON trips FOR DELETE USING (auth.uid() = user_id);
```

**Child tables (plan_versions, etc.):**
```sql
CREATE POLICY "plan_versions_all" ON plan_versions FOR ALL USING (
  is_trip_owner(trip_id, auth.uid()) OR is_trip_shared_with_user(trip_id, auth.uid())
);
```

**Nested tables (itinerary_days, etc.):**
```sql
CREATE POLICY "itinerary_days_all" ON itinerary_days FOR ALL USING (
  EXISTS (
    SELECT 1 FROM plan_versions pv
    WHERE pv.id = itinerary_days.plan_version_id
    AND (is_trip_owner(pv.trip_id, auth.uid())
         OR is_trip_shared_with_user(pv.trip_id, auth.uid()))
  )
);
```

---

## Storage

### Create Bucket

```sql
-- Create storage bucket for trip documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-documents', 'trip-documents', false);
```

### Storage Policies

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload documents" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'trip-documents');

-- Allow users to read their documents
CREATE POLICY "Users can read own documents" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'trip-documents');

-- Allow users to delete their documents
CREATE POLICY "Users can delete own documents" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'trip-documents');
```

---

## Authentication

### Enable Providers

1. Go to **Authentication** → **Providers**
2. Enable **Email** (for Magic Links)
3. Enable **Google** (for OAuth)

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI:
   ```
   https://[project-ref].supabase.co/auth/v1/callback
   ```
4. Copy Client ID and Secret to Supabase dashboard

### Email Configuration

For production, configure custom SMTP:

1. Go to **Authentication** → **Email Templates**
2. Go to **Settings** → **SMTP Settings**
3. Add your SMTP credentials

Default Supabase email has rate limits (4 emails/hour).

### Auth Settings

```toml
# supabase/config.toml
[auth]
site_url = "https://your-app.vercel.app"
additional_redirect_urls = ["http://localhost:3000"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
enable_confirmations = false
otp_length = 6
otp_expiry = 3600
```

---

## Triggers

### Auto-Update Total Cost

```sql
CREATE OR REPLACE FUNCTION update_plan_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE plan_versions
  SET total_cost = (
    SELECT COALESCE(SUM(amount), 0)
    FROM costs
    WHERE plan_version_id = COALESCE(NEW.plan_version_id, OLD.plan_version_id)
  ),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.plan_version_id, OLD.plan_version_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER costs_update_total
AFTER INSERT OR UPDATE OR DELETE ON costs
FOR EACH ROW EXECUTE FUNCTION update_plan_total();
```

### Auto-Update Timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER plan_versions_updated_at
BEFORE UPDATE ON plan_versions
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER checklist_items_updated_at
BEFORE UPDATE ON checklist_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## Indexes

```sql
-- Foreign key indexes
CREATE INDEX idx_plan_versions_trip_id ON plan_versions(trip_id);
CREATE INDEX idx_itinerary_days_plan_version_id ON itinerary_days(plan_version_id);
CREATE INDEX idx_accommodations_plan_version_id ON accommodations(plan_version_id);
CREATE INDEX idx_transport_plan_version_id ON transport(plan_version_id);
CREATE INDEX idx_costs_plan_version_id ON costs(plan_version_id);
CREATE INDEX idx_checklist_items_plan_version_id ON checklist_items(plan_version_id);
CREATE INDEX idx_activities_itinerary_day_id ON activities(itinerary_day_id);
CREATE INDEX idx_decisions_trip_id ON decisions(trip_id);
CREATE INDEX idx_trip_shares_trip_id ON trip_shares(trip_id);
CREATE INDEX idx_trip_shares_user_id ON trip_shares(shared_with_user_id);
CREATE INDEX idx_travellers_trip_id ON travellers(trip_id);
CREATE INDEX idx_packing_items_trip_id ON packing_items(trip_id);
CREATE INDEX idx_documents_trip_id ON documents(trip_id);
CREATE INDEX idx_comments_item ON comments(item_type, item_id);

-- Query optimization indexes
CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_itinerary_days_date ON itinerary_days(date);
CREATE INDEX idx_accommodations_dates ON accommodations(check_in, check_out);
CREATE INDEX idx_ai_cache_lookup ON ai_research_cache(trip_id, query, query_type);
CREATE INDEX idx_ai_cache_expiry ON ai_research_cache(expires_at);
```

---

## Monitoring

### Database Stats

```sql
-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Row counts
SELECT
  schemaname,
  relname,
  n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

### Query Performance

Go to **Database** → **Query Performance** in Supabase dashboard.

---

## Supabase CLI

### Installation

```bash
npm install -g supabase
```

### Commands

```bash
# Link to existing project
supabase link --project-ref [project-ref]

# Pull remote schema
supabase db pull

# Push local migrations
supabase db push

# Generate TypeScript types
supabase gen types typescript --linked > lib/database.types.ts

# Start local development
supabase start

# Stop local development
supabase stop
```

---

## Pricing Tiers

| Feature | Free | Pro ($25/mo) | Team ($599/mo) |
|---------|------|--------------|----------------|
| Database | 500MB | 8GB | 50GB |
| Storage | 1GB | 100GB | 500GB |
| Bandwidth | 2GB | 250GB | 1TB |
| PITR | No | Yes (7 days) | Yes (30 days) |
| Daily Backups | No | Yes | Yes |
| Custom Domains | No | Yes | Yes |
| Support | Community | Email | Priority |

**Recommendation:** Use Pro plan for PITR capability.
