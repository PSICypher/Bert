# API Specification

## Overview

The Holiday Planner App exposes RESTful API endpoints via Next.js API routes. All endpoints require authentication unless otherwise noted.

---

## Authentication

All API routes follow this pattern:

```typescript
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... route logic
}
```

---

## Core Resource Endpoints

### Trips

#### `GET /api/trips`
List all trips for the authenticated user.

**Query Parameters:**
- `archived` (optional): `true` | `false` - Filter by archive status

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Florida 2026",
    "destination": "Florida, USA",
    "start_date": "2026-05-19",
    "end_date": "2026-06-08",
    "cover_image_url": "https://...",
    "is_archived": false,
    "user_id": "uuid",
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-02-09T15:30:00Z"
  }
]
```

#### `POST /api/trips`
Create a new trip.

**Request Body:**
```json
{
  "name": "Florida 2026",
  "description": "Family holiday to Florida",
  "destination": "Florida, USA",
  "start_date": "2026-05-19",
  "end_date": "2026-06-08",
  "cover_image_url": "https://..."
}
```

**Response:** `201 Created` - Returns created trip object

#### `GET /api/trips/[id]`
Get a single trip with metadata.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Florida 2026",
  "destination": "Florida, USA",
  "start_date": "2026-05-19",
  "end_date": "2026-06-08",
  "plan_versions_count": 2,
  "pending_decisions_count": 3
}
```

#### `PATCH /api/trips/[id]`
Update a trip.

**Allowed Fields:** `name`, `description`, `destination`, `start_date`, `end_date`, `cover_image_url`, `is_archived`

#### `DELETE /api/trips/[id]`
Delete a trip.

**Response:** `204 No Content`

---

### Trip Sharing

#### `GET /api/trips/[id]/shares`
List all shares for a trip.

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "trip_id": "uuid",
    "shared_with_email": "vdmkelz@gmail.com",
    "shared_with_user_id": "uuid",
    "permission": "edit",
    "accepted_at": "2026-01-20T10:00:00Z",
    "created_at": "2026-01-15T10:00:00Z"
  }
]
```

#### `POST /api/trips/[id]/shares`
Share a trip with another user.

**Request Body:**
```json
{
  "email": "vdmkelz@gmail.com",
  "permission": "view" | "edit" | "admin"
}
```

**Validation:**
- Email must be in ALLOWED_EMAILS list
- Cannot share with yourself
- Cannot duplicate existing shares

**Response:** `201 Created`

#### `PATCH /api/trips/[id]/shares/[shareId]`
Update share permission.

**Request Body:**
```json
{
  "permission": "view" | "edit" | "admin"
}
```

#### `DELETE /api/trips/[id]/shares/[shareId]`
Remove a share.

**Response:** `204 No Content`

---

### Public Sharing

#### `POST /api/trips/[id]/public-token`
Generate or retrieve a public share token.

**Response:** `200 OK`
```json
{
  "token": "abc123..."
}
```

#### `DELETE /api/trips/[id]/public-token`
Revoke public share token.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### Trip Export

#### `GET /api/trips/[id]/export`
Export trip as HTML document (printable/PDF ready).

**Response:** `200 OK` - HTML content

---

### Plan Versions

#### `GET /api/plan-versions`
List plan versions for a trip.

**Query Parameters:**
- `trip_id` (required): Trip UUID

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "trip_id": "uuid",
    "name": "Plan A",
    "description": "Main plan",
    "is_active": true,
    "total_cost": 29337.38,
    "currency": "GBP",
    "color": "#8B5CF6",
    "created_at": "...",
    "updated_at": "..."
  }
]
```

#### `POST /api/plan-versions`
Create a new plan version.

**Request Body:**
```json
{
  "trip_id": "uuid",
  "name": "Plan B",
  "description": "Alternative plan",
  "is_active": false,
  "currency": "GBP",
  "color": "#10B981"
}
```

#### `PATCH /api/plan-versions/[id]`
Update a plan version.

**Allowed Fields:** `name`, `description`, `is_active`, `currency`, `color`

#### `DELETE /api/plan-versions/[id]`
Delete a plan version.

**Note:** Cannot delete the last remaining plan version.

**Response:** `204 No Content` or `400 Bad Request` if last plan

#### `POST /api/plan-versions/[id]/clone`
Clone a plan version with all its data.

**Request Body:**
```json
{
  "name": "Plan C" // Optional, defaults to "[Original Name] (Copy)"
}
```

**Clones:**
- Itinerary days
- Accommodations (with day mappings)
- Transport items
- Cost items
- Activities (linked to cloned days)

**Response:** `201 Created` - Returns cloned plan with all related data

---

### Accommodations

#### `GET /api/accommodations`
List accommodations for a plan version.

**Query Parameters:**
- `plan_version_id` (required): Plan version UUID

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "plan_version_id": "uuid",
    "name": "Bayside Resort",
    "type": "hotel",
    "location": "Islamorada",
    "address": "123 Resort Drive",
    "coordinates": {"lat": 24.9, "lng": -80.6},
    "check_in": "2026-05-21",
    "check_out": "2026-05-23",
    "nights": 2,
    "cost": 450.00,
    "currency": "GBP",
    "booking_reference": "ABC123",
    "booking_url": "https://...",
    "cancellation_policy": "Free cancellation until...",
    "amenities": ["Pool", "WiFi", "Breakfast"],
    "notes": "Ask for ocean view",
    "color": "#8B5CF6",
    "is_confirmed": true
  }
]
```

#### `POST /api/accommodations`
Create an accommodation.

**Request Body:** All fields from above except `id`, `nights` (calculated)

#### `GET /api/accommodations/[id]`
Get a single accommodation.

#### `PATCH /api/accommodations/[id]`
Update an accommodation.

**Allowed Fields:** All except `id`, `plan_version_id`

#### `DELETE /api/accommodations/[id]`
Delete an accommodation.

**Response:** `204 No Content`

---

### Transport

Same CRUD pattern as accommodations.

**Fields:**
```json
{
  "id": "uuid",
  "plan_version_id": "uuid",
  "type": "car_rental" | "flight" | "train" | "bus" | "transfer",
  "provider": "Alamo",
  "vehicle": "SUV",
  "pickup_location": "Orlando Airport",
  "pickup_date": "2026-05-19",
  "pickup_time": "14:00",
  "dropoff_location": "Miami Airport",
  "dropoff_date": "2026-06-08",
  "dropoff_time": "10:00",
  "cost": 1200.00,
  "currency": "GBP",
  "booking_reference": "XYZ789",
  "booking_url": "https://...",
  "notes": "Child seat requested",
  "is_confirmed": true
}
```

---

### Costs

**Note:** There is NO dedicated `/api/costs/` REST endpoint. Costs are managed:
1. Directly via Supabase client in components
2. Created automatically when AI generates plans
3. Updated via the CostBreakdown and other components using direct Supabase calls

**If implementing a REST API, use this schema:**

**Fields:**
```json
{
  "id": "uuid",
  "plan_version_id": "uuid",
  "itinerary_day_id": "uuid (optional)",
  "category": "accommodation" | "transport" | "activities" | "food" | "tickets" | "misc",
  "item": "Universal Theme Park Tickets",
  "amount": 1500.00,
  "currency": "GBP",
  "is_paid": true,
  "is_estimated": false,
  "notes": "14-day all park tickets"
}
```

**Direct Supabase Pattern Used:**
```typescript
const supabase = createBrowserSupabaseClient();

// Create cost
const { data, error } = await supabase
  .from('costs')
  .insert({ plan_version_id, category, item, amount })
  .select()
  .single();

// Update cost
await supabase.from('costs').update({ amount }).eq('id', costId);

// Delete cost
await supabase.from('costs').delete().eq('id', costId);
```

**Trigger:** When costs change, `plan_versions.total_cost` is auto-updated via database trigger.

---

### Activities

#### `GET /api/activities`
**Query Parameters:**
- `plan_version_id` OR `itinerary_day_id`

#### `POST /api/activities`
Supports single or bulk creation.

**Single:**
```json
{
  "plan_version_id": "uuid",
  "itinerary_day_id": "uuid",
  "name": "Universal Studios",
  "time_start": "09:00",
  "time_end": "18:00",
  "location": "Orlando",
  "cost": 150.00,
  "notes": "Buy express pass",
  "booking_status": "not_booked" | "booked" | "confirmed"
}
```

**Bulk:**
```json
[
  { "name": "Activity 1", ... },
  { "name": "Activity 2", ... }
]
```

#### `PATCH /api/activities`
**Request Body:**
```json
{
  "id": "uuid",
  "name": "Updated name",
  "booking_status": "booked"
}
```

#### `DELETE /api/activities`
**Query Parameters:**
- `id`: Activity UUID

---

### Decisions

#### `GET /api/decisions`
**Query Parameters:**
- `trip_id` (required)
- `status` (optional): Filter by status

**Fields:**
```json
{
  "id": "uuid",
  "trip_id": "uuid",
  "plan_version_id": "uuid",
  "title": "Which hotel in Miami?",
  "description": "Need to decide between 3 options",
  "options": [
    {"name": "Option A", "description": "Budget choice"},
    {"name": "Option B", "description": "Premium choice"}
  ],
  "selected_option": 0,
  "due_date": "2026-03-01",
  "priority": "high" | "medium" | "low",
  "status": "pending" | "decided" | "cancelled",
  "decided_at": null,
  "notes": "Discuss with Kelly"
}
```

---

### Travellers

#### `GET /api/travellers`
**Query Parameters:**
- `trip_id` (required)

**Fields:**
```json
{
  "id": "uuid",
  "trip_id": "uuid",
  "name": "John Doe",
  "passport_number": "AB123456",
  "passport_expiry": "2030-06-15",
  "nationality": "British",
  "esta_status": "approved" | "pending" | "not_required" | "expired",
  "dietary": "Vegetarian",
  "medical_notes": "Peanut allergy",
  "is_child": false
}
```

---

### Packing

#### `GET /api/packing`
**Query Parameters:**
- `trip_id` (required)

**Fields:**
```json
{
  "id": "uuid",
  "trip_id": "uuid",
  "name": "Sunscreen SPF 50",
  "category": "Toiletries",
  "quantity": 2,
  "packed": false,
  "assigned_to": "John"
}
```

**Categories:** Clothes, Toiletries, Electronics, Documents, Kids, Beach/Pool, Medications, Misc

---

### Documents

#### `GET /api/documents`
**Query Parameters:**
- `trip_id` (required)

#### `POST /api/documents`
**Request:** `multipart/form-data`
- `file`: The document file
- `trip_id`: Trip UUID
- `linked_item_type` (optional): "accommodation" | "transport" | etc.
- `linked_item_id` (optional): UUID of linked item
- `notes` (optional): Document notes

**Storage:** Supabase Storage bucket `trip-documents`

**Supported Types:** PDF, JPG, PNG, WEBP, DOC, DOCX (max 10MB)

#### `DELETE /api/documents`
**Query Parameters:**
- `id`: Document UUID

---

### Comments

#### `GET /api/comments`
**Query Parameters:**
- `trip_id` (required)
- `item_type` (required)
- `item_id` (required)

#### `POST /api/comments`
```json
{
  "trip_id": "uuid",
  "item_type": "accommodation",
  "item_id": "uuid",
  "message": "This looks great!"
}
```

#### `DELETE /api/comments`
**Query Parameters:**
- `id`: Comment UUID

---

### Travel Insurance

#### `GET /api/travel-insurance`
**Query Parameters:**
- `trip_id` (required)

**Fields:**
```json
{
  "id": "uuid",
  "trip_id": "uuid",
  "provider": "Allianz",
  "policy_number": "POL123456",
  "emergency_phone": "+44 800 123 456",
  "coverage_start": "2026-05-19",
  "coverage_end": "2026-06-08",
  "document_url": "https://...",
  "notes": "Covers medical up to £10M"
}
```

---

## External API Endpoints

### Weather

#### `GET /api/weather`
**Query Parameters:**
- `lat` (required): Latitude
- `lng` (required): Longitude

**External API:** Open-Meteo (free, no key required)

**Cache:** 1 hour in-memory

**Response:**
```json
{
  "forecast": [
    {
      "date": "2026-05-19",
      "tempMax": 32,
      "tempMin": 24,
      "precipChance": 20,
      "weatherCode": 1
    }
  ]
}
```

---

### Exchange Rate

#### `GET /api/exchange-rate`
**Query Parameters:**
- `from` (optional, default: "GBP")
- `to` (optional, default: "USD")

**External API:** Frankfurter.app (free, no key required)

**Cache:** 24 hours in-memory

**Response:**
```json
{
  "from": "GBP",
  "to": "USD",
  "rate": 1.27,
  "date": "2026-02-09"
}
```

---

## AI Endpoints

### Research

#### `POST /api/ai/research`
```json
{
  "query": "Best family hotels near Universal Orlando",
  "type": "hotel" | "activity" | "restaurant" | "transport" | "general",
  "trip_id": "uuid",
  "location": "Orlando",
  "date_range": {"start": "2026-05-19", "end": "2026-06-08"},
  "budget": {"min": 100, "max": 300, "currency": "GBP"},
  "preferences": ["family-friendly", "pool"]
}
```

**Response:**
```json
{
  "result": {
    "text": "Here are my recommendations...",
    "suggestions": [
      {
        "name": "Loews Royal Pacific Resort",
        "cost": 250,
        "costRange": {"min": 200, "max": 300},
        "location": "Universal Resort",
        "description": "On-site Universal hotel",
        "pros": ["Express Pass included", "Walking distance"],
        "cons": ["Higher price"]
      }
    ]
  },
  "cached": false
}
```

**Cache:** 24 hours

---

### Generate Plan

#### `POST /api/ai/generate-plan`
```json
{
  "destination": "Florida, USA",
  "startDate": "2026-05-19",
  "endDate": "2026-06-08",
  "travellerCount": 4,
  "preferences": "Family with teenagers, theme parks, beaches"
}
```

**Response:** Complete trip plan JSON with days, accommodations, transport, costs

---

### Compare Plans

#### `POST /api/ai/compare`
```json
{
  "trip_id": "uuid"
}
```

**Requires:** Minimum 2 plan versions

**Cache:** 1 hour

---

### Cost Optimization

#### `POST /api/ai/optimise`
```json
{
  "trip_id": "uuid",
  "plan_version_id": "uuid"
}
```

**Cache:** 6 hours

---

### Plan Change

#### `POST /api/ai/plan-change`
```json
{
  "trip_id": "uuid",
  "plan_version_id": "uuid",
  "item_type": "accommodation" | "transport" | "cost" | "itinerary_day",
  "current_item": { ... },
  "change_request": "Find a cheaper alternative",
  "conversation_history": [],
  "destination": "Florida"
}
```

**Response:**
```json
{
  "result": {
    "text": "Here are some alternatives...",
    "options": [
      {
        "name": "Budget Inn",
        "type": "accommodation",
        "cost": 100,
        "currency": "GBP",
        "location": "Orlando",
        "description": "...",
        "pros": ["Low cost"],
        "cons": ["Basic amenities"],
        "applyData": { ... }
      }
    ]
  },
  "cached": false
}
```

---

### Suggestions

#### `POST /api/ai/suggestions`
```json
{
  "trip_id": "uuid",
  "plan_version_id": "uuid",
  "request": "Suggest where to add rest days"
}
```

**Cache:** 24 hours

---

### Extract from Link

#### `POST /api/ai/extract-link`
```json
{
  "url": "https://booking.com/hotel/...",
  "item_type": "accommodation" | "transport" | "cost" | "itinerary_day"
}
```

**Response:** Structured data extracted from webpage

---

### Add to Plan

#### `POST /api/ai/add-to-plan`
```json
{
  "plan_version_id": "uuid",
  "trip_id": "uuid",
  "suggestion_type": "accommodation" | "activity" | "cost" | "decision",
  "data": {
    "name": "...",
    "cost": 100,
    "location": "...",
    "pros": [],
    "cons": []
  }
}
```

---

### Generate Packing List

#### `POST /api/ai/generate-packing`
```json
{
  "destination": "Florida, USA",
  "startDate": "2026-05-19",
  "endDate": "2026-06-08",
  "travellerCount": 4,
  "activities": ["theme parks", "beach", "swimming"]
}
```

---

## Push Notifications

### Subscribe

#### `POST /api/push/subscribe`
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

### Notify

#### `POST /api/push/notify`
```json
{
  "title": "Trip Updated",
  "message": "Kelly made changes to Florida 2026",
  "excludeUserId": "uuid"
}
```

---

## Import Sample Data

### Florida Trip Import

#### `POST /api/trips/import-florida`

**Access:** Restricted to allowlisted emails

**Response:**
```json
{
  "tripId": "uuid",
  "planId": "uuid"
}
```

---

## Error Responses

All endpoints follow consistent error format:

```json
{
  "error": "Error message"
}
```

**Status Codes:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not allowed (e.g., not in allowlist)
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate resource
- `500 Internal Server Error` - Server error
