# Seed Data - Florida Family Adventure 2026

This folder contains the actual trip data to populate a new database after rebuilding the app.

## Contents

- `florida-trip-data.json` - Complete trip data export
- `import-seed.js` - Node.js script to import the data

## Data Summary

| Table | Records |
|-------|---------|
| Trip | 1 |
| Plan Versions | 1 |
| Itinerary Days | 19 |
| Accommodations | 7 |
| Transport | 1 |
| Costs | 16 |
| Checklist Items | 16 |
| **Total** | **61 records** |

## Trip Overview

**Florida Family Adventure 2026**
- Dates: July 7-25, 2026 (19 days)
- Total Budget: £29,337.38

### Itinerary Highlights

1. **Days 1-2:** Miami (The Betsy Hotel, South Beach)
2. **Days 3-4:** Florida Keys - Islamorada (Bayside Resort)
3. **Day 5:** Drive to Naples via Everglades
4. **Day 6:** Tampa (Ybor City, Columbia Restaurant)
5. **Days 7-12:** Orlando (Portofino + Vista Cay Condo)
   - Universal Studios with Express Pass
   - Discovery Cove
   - Kennedy Space Center
6. **Days 13-18:** Caribbean Cruise (6 nights)
7. **Day 19:** Everglades Airboat + Fly Home

## How to Import

### Prerequisites

1. Create a new Supabase project
2. Run all migrations from PROJECT_SPEC
3. Get your service role key

### Import Steps

```bash
# Install dependencies
npm install @supabase/supabase-js

# Set environment variables
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-role-key

# Run import
node import-seed.js
```

### Important Notes

1. **User ID:** The import script will use YOUR user ID (the authenticated user)
2. **UUIDs:** New UUIDs will be generated to avoid conflicts
3. **Relationships:** The script maintains all foreign key relationships
4. **Checklist:** Includes the £2,016 cruise deposit that was paid

## Data Integrity

This export was made on 2026-02-09 and reflects the state after:
- Bayside Resort was correctly named (fixed from "Amara Cay")
- Cruise shows £2,016 deposit paid
- 16 checklist items with proper source linking
