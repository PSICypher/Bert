# Data Flows

## Overview

This document describes how data moves through the Holiday Planner App, with special attention to the sync logic that caused data loss.

---

## Core Data Model

```
┌────────────────────────────────────────────────────────────────────┐
│                              trips                                  │
│  (One user can have many trips)                                     │
└────────────────────┬───────────────────────────────────────────────┘
                     │
                     │ 1:many
                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                          plan_versions                              │
│  (One trip can have multiple plan versions: Plan A, B, C)           │
└────────────────────┬───────────────────────────────────────────────┘
                     │
          ┌──────────┼──────────┬──────────────┐
          │          │          │              │
          │ 1:many   │ 1:many   │ 1:many       │ 1:many
          ▼          ▼          ▼              ▼
┌──────────────┐ ┌──────────┐ ┌─────────┐ ┌────────────────┐
│ itinerary_   │ │ accomm-  │ │ trans-  │ │ checklist_     │
│ days         │ │ odations │ │ port    │ │ items          │
│              │ │          │ │         │ │                │
│ (Day-by-day) │ │ (Hotels) │ │ (Cars)  │ │ (User-curated) │
└──────┬───────┘ └──────────┘ └─────────┘ └────────────────┘
       │
       │ 1:many
       ▼
┌──────────────┐
│ activities   │
│              │
│ (Per-day)    │
└──────────────┘
```

---

## Critical Understanding: Checklist vs Source Tables

### The Mistake That Caused Data Loss

**Wrong Assumption:**
> "Checklist items should mirror accommodations/transport/costs tables"

**Correct Understanding:**
> "Checklist is a USER-CURATED document that MAY reference source tables"

### Key Differences

| Source Tables | Checklist Items |
|---------------|-----------------|
| Auto-populated from AI or user input | User decides what to track |
| Used for itinerary display | Used for booking/payment tracking |
| No payment info | Has deposit, amount_paid, due dates |
| No booking status | Has booking_status (not_booked, booked, confirmed) |
| Totals feed plan_version.total_cost | Totals independent (may differ) |

### Checklist Item Types

**Linked Items (have `source_id`):**
- Created via "Seed from Plan"
- Reference accommodations, transport, or costs table
- Name may change if source changes
- Can be deleted if user wants

**Manual Items (no `source_id`):**
- Created directly by user
- Contain unique user data (deposits, references, notes)
- **NEVER auto-delete these**
- Examples: insurance, tips, extras not in main plan

---

## Data Flow: Creating a Trip

```
1. User enters trip details (destination, dates)
         │
         ▼
2. POST /api/trips creates trip record
         │
         ▼
3. POST /api/ai/generate-plan generates AI itinerary
         │
         ▼
4. POST /api/plan-versions creates default "Plan A"
         │
         ▼
5. Bulk insert to itinerary_days, accommodations, transport, costs
         │
         ▼
6. User navigates to trip dashboard
         │
         ▼
7. Page loads all data via server component queries
```

---

## Data Flow: Booking Checklist

### Loading Checklist

```
1. BookingChecklist component mounts
         │
         ▼
2. Fetch checklist_items WHERE plan_version_id = [current]
         │
         ▼
3. Display items grouped by category
         │
         ▼
4. Calculate totals (total_cost, amount_paid)
```

### Seed from Plan (SAFE)

```
1. User clicks "Seed from Plan"
         │
         ▼
2. Fetch all accommodations, transport, costs for plan
         │
         ▼
3. For each source item:
         │
         ├─── Check if checklist already has item with this source_id
         │           │
         │           ├─── YES: Skip (already exists)
         │           │
         │           └─── NO: INSERT new checklist_item with:
         │                     - source_type (accommodation/transport/cost)
         │                     - source_id (UUID of source)
         │                     - name (from source)
         │                     - total_cost (from source)
         │
         ▼
4. NEVER delete existing items
         │
         ▼
5. Return count of items added
```

### Updating Checklist Item

```
1. User modifies field (status, amount_paid, notes, etc.)
         │
         ▼
2. PATCH /api/checklist-items/[id] with changes
         │
         ▼
3. Update local state
         │
         ▼
4. ❌ DO NOT auto-sync back to source tables
    (Checklist is independent)
```

---

## Data Flow: Timeline Display

### Loading Timeline

```
1. Page component fetches from multiple tables:
         │
         ├─── trips (trip info)
         ├─── plan_versions (active plan)
         ├─── itinerary_days (day-by-day data)
         ├─── accommodations (hotel info)
         ├─── transport (car/flight info)
         └─── costs (estimated costs)
         │
         ▼
2. DayCardGrid receives data via props
         │
         ▼
3. Each day card shows:
         - Date, location, icon
         - Activities list
         - Associated accommodation (via day mapping)
         - Day costs
```

### Important: Timeline Reads from Source Tables

The timeline (DayCardGrid) displays data **directly from the source tables** (accommodations, transport, etc.), NOT from checklist_items.

This means:
- Changing accommodation name in checklist does NOT update timeline
- Timeline always shows "source of truth" data
- Checklist is for tracking booking progress

---

## Data Flow: Changing an Accommodation

### Correct Flow (via ChangeSheet)

```
1. User clicks edit on day card
         │
         ▼
2. ChangeSheet opens with current accommodation data
         │
         ▼
3. User either:
   ├─── AI Chat: Get suggestions, select one with applyData
   ├─── Manual Edit: Fill out form
   └─── Link Extract: Paste booking URL, extract data
         │
         ▼
4. User confirms changes
         │
         ▼
5. PATCH /api/accommodations/[id] updates source table
         │
         ▼
6. onApplied() callback refreshes parent data
         │
         ▼
7. Timeline now shows updated data
         │
         ▼
8. ⚠️ Checklist item (if linked) NOT auto-updated
   - User must manually update checklist if needed
   - Or use "Sync" feature with preview/confirmation
```

---

## Data Flow: Plan Comparison

```
1. User has Plan A and Plan B
         │
         ▼
2. Navigate to AI Insights tab
         │
         ▼
3. Click "Analyse Plans"
         │
         ▼
4. POST /api/ai/compare with trip_id
         │
         ▼
5. Server fetches all plan versions for trip
         │
         ▼
6. For each plan, fetch:
   - itinerary_days (count, locations)
   - accommodations (names, costs)
   - transport (types, costs)
   - costs (total)
         │
         ▼
7. Build comparison request for Claude
         │
         ▼
8. Claude analyzes and returns comparison
         │
         ▼
9. Cache result for 1 hour
         │
         ▼
10. Display analysis in UI
```

---

## Data Flow: Cloning a Plan

```
1. User clicks "Duplicate" on Plan A
         │
         ▼
2. POST /api/plan-versions/[id]/clone
         │
         ▼
3. Server creates new plan_version "Plan A (Copy)"
         │
         ▼
4. Clone itinerary_days (with new UUIDs)
         │
         ▼
5. Clone accommodations with ID mapping:
   - New IDs for cloned accommodations
   - Update day references to use cloned day IDs
         │
         ▼
6. Clone transport items
         │
         ▼
7. Clone cost items
         │
         ▼
8. Clone activities (linked to cloned days)
         │
         ▼
9. Return new plan with all cloned data
         │
         ▼
10. UI adds new tab and selects it
```

---

## Sync Logic: The DANGEROUS Pattern

### What Caused Data Loss

```
❌ WRONG: Auto-sync with deletion

1. User reports "checklist total differs from plan total"
         │
         ▼
2. AI implements "fix" with sync logic:
         │
         ├─── Get all accommodations/transport/costs
         │
         ├─── Get all checklist_items
         │
         ├─── Find "orphans" (checklist items not matching source)
         │
         └─── DELETE orphans automatically ←── DISASTER
                    │
                    ▼
         User's manual entries with deposits,
         booking references, and notes are GONE
```

### Correct Pattern: Preview and Confirm

```
✓ CORRECT: Preview-based sync

1. User clicks "Sync with Plan"
         │
         ▼
2. Calculate changes:
   - items_to_add (in source but not checklist)
   - items_to_update (linked items where source changed)
   - items_potentially_removable (in checklist but not source)
         │
         ▼
3. Show preview dialog:

   ┌────────────────────────────────────┐
   │ Review Sync Changes                 │
   ├────────────────────────────────────┤
   │ Will be added: (green)             │
   │   ☑ New Hotel Name                 │
   │   ☑ New Activity                   │
   │                                    │
   │ Will be updated: (yellow)          │
   │   ☑ Bayside Resort (was Amara Cay) │
   │                                    │
   │ Consider removing: (red)           │
   │   ☐ Manual Item 1 (manual entry)   │
   │   ☐ Old Activity (not in plan)     │
   │                                    │
   │ ⚠️ Unchecked items will be kept    │
   │                                    │
   │ [Cancel]              [Apply]      │
   └────────────────────────────────────┘
         │
         ▼
4. User reviews and checks boxes
         │
         ▼
5. Only checked items are processed
         │
         ▼
6. Log all changes for audit
```

---

## Total Calculations

### Plan Total (auto-calculated)

```sql
-- Trigger updates plan_version.total_cost when costs change
CREATE OR REPLACE FUNCTION update_plan_total() RETURNS TRIGGER AS $$
BEGIN
  UPDATE plan_versions
  SET total_cost = (
    SELECT COALESCE(SUM(amount), 0)
    FROM costs
    WHERE plan_version_id = COALESCE(NEW.plan_version_id, OLD.plan_version_id)
  )
  WHERE id = COALESCE(NEW.plan_version_id, OLD.plan_version_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Checklist Total (independent)

```typescript
// Calculated in component
const checklistTotal = items.reduce((sum, item) => sum + item.total_cost, 0);
const amountPaid = items.reduce((sum, item) => sum + item.amount_paid, 0);
const remaining = checklistTotal - amountPaid;
```

### Why Totals May Differ

| Scenario | Plan Total | Checklist Total |
|----------|------------|-----------------|
| User added travel insurance manually | Lower | Higher |
| User removed item from tracking | Higher | Lower |
| User added tip estimates | Lower | Higher |
| User tracking subset of costs | Higher | Lower |

**This is intentional and valid!** Don't try to auto-reconcile.

---

## Best Practices for Data Operations

### Before Any DELETE

1. **Show confirmation dialog**
2. **List exactly what will be deleted**
3. **Explain consequences**
4. **Require explicit user action**

### Before Any Bulk UPDATE

1. **Show preview of changes**
2. **Highlight what's changing**
3. **Allow user to deselect items**
4. **Log all changes**

### Protecting Manual Entries

```typescript
// Identify manual entries
const manualItems = items.filter(i => !i.source_id);

// NEVER auto-delete these
if (manualItems.some(i => itemsToDelete.includes(i.id))) {
  throw new Error('Cannot auto-delete manual entries');
}
```

### Logging Changes

```typescript
interface ChangeLog {
  timestamp: string;
  user_id: string;
  action: 'create' | 'update' | 'delete';
  table: string;
  record_id: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
}
```

---

## Recovery Procedures

### If Wrong Data Displayed

1. Check source table directly (not checklist)
2. Use Supabase dashboard to verify data
3. Update via ChangeSheet (not direct SQL unless necessary)

### If Data Accidentally Deleted

1. **If PITR enabled:** Restore from point in time
2. **If no PITR:** Check for exports, screenshots
3. **Last resort:** Manually re-enter from memory

### Prevention

- Enable Supabase PITR ($25/month Pro plan)
- Weekly data exports
- Never auto-delete without confirmation
