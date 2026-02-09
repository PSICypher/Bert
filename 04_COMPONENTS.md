# React Components

## Component Hierarchy

```
/app
  /page.tsx (Dashboard)
    └── TripCard (repeated for each trip)

  /trips/[id]/page.tsx (Trip Dashboard)
    ├── TripHeader
    │   ├── ShareModal
    │   └── ExportButton
    ├── TripDashboardHeader
    ├── PlanVersionTabs
    ├── Tab Content (conditional)
    │   ├── Overview Tab
    │   │   ├── JourneyOverview
    │   │   ├── DayCardGrid
    │   │   │   └── DayActivities
    │   │   ├── TripMap
    │   │   │   └── TripMapInner
    │   │   ├── SummaryCards
    │   │   └── CostBreakdown
    │   ├── Research Tab
    │   │   └── ResearchChat
    │   ├── Checklist Tab
    │   │   └── BookingChecklist
    │   ├── Travel Docs Tab
    │   │   └── TravelDocsHub
    │   ├── Documents Tab
    │   │   └── DocumentsTab
    │   ├── Packing Tab
    │   │   └── PackingList
    │   └── AI Insights Tab
    │       └── AiInsights
    ├── CurrencyWidget
    └── ChangeSheet (modal)

/components
  ├── FloridaMap
  │   └── FloridaMapInner
  └── /trip
      ├── AiInsights
      ├── BookingChecklist
      ├── ChangeSheet
      ├── CommentThread
      ├── CostBreakdown
      ├── CurrencyWidget
      ├── DayActivities
      ├── DayCard
      ├── DayCardGrid
      ├── DocumentsTab
      ├── ExportButton
      ├── JourneyOverview
      ├── PackingList
      ├── PlanVersionTabs
      ├── ResearchChat
      ├── ShareModal
      ├── SummaryCards
      ├── Timeline
      ├── TravelDocsHub
      ├── TripDashboardHeader
      ├── TripHeader
      ├── TripMap
      └── TripMapInner
```

---

## Component Details

### TripHeader

**File:** `/components/trip/TripHeader.tsx`

**Props:**
```typescript
interface TripHeaderProps {
  trip: Trip;
  plan?: PlanVersion;
}
```

**State:**
- `shareOpen: boolean` - Controls ShareModal visibility

**Features:**
- Trip title, description, date range display
- Back navigation link
- Share button (opens ShareModal)
- Export button
- Total estimated cost pill

---

### TripDashboardHeader

**File:** `/components/trip/TripDashboardHeader.tsx`

**Props:**
```typescript
interface TripDashboardHeaderProps {
  trip: Trip;
  plan: PlanVersion | null;
  days: ItineraryDay[];
  accommodations: Accommodation[];
  costs: Cost[];
  decisions: Decision[];
}
```

**State:**
- `checklist: ChecklistItem[]`
- `weather: WeatherDay[]`
- `packingCount: { total: number, packed: number }`

**Features:**
- Gradient header with key metrics
- Countdown timer (days until trip)
- Booking progress (items booked/total)
- Payment progress (paid/total)
- Pending decisions count
- Packing progress
- Weather forecast with icons

---

### PlanVersionTabs

**File:** `/components/trip/PlanVersionTabs.tsx`

**Props:**
```typescript
interface PlanVersionTabsProps {
  plans: PlanVersion[];
  activePlanId: string;
  tripId: string;
  onSelectPlan: (planId: string) => void;
  onPlansChanged: () => void;
}
```

**State:**
- `menuOpenId: string | null` - Dropdown menu for plan
- `editingId: string | null` - Plan being renamed
- `editName: string` - New name during edit
- `showAddForm: boolean` - Show add plan form
- `newPlanName: string` - New plan name input
- `loading: boolean` - API request state

**Features:**
- Horizontal scrollable tab bar
- Color-coded plan indicators
- Plan cost display
- Context menu: Rename, Duplicate, Set as default, Delete
- Inline name editing
- Add new plan form
- Cannot delete last plan

---

### DayCardGrid

**File:** `/components/trip/DayCardGrid.tsx`

**Props:**
```typescript
interface DayCardGridProps {
  days: ItineraryDay[];
  accommodations: Accommodation[];
  costs: Cost[];
  currencySymbol: string;
  onChangeDay?: (day: ItineraryDay) => void;
}
```

**State:**
- `expandedDayId: string | null`

**Features:**
- Responsive grid (1-4 columns)
- Clickable cards to expand
- Location, date, icon, drive time
- Expanded view: activities, accommodation, costs
- Edit button for day changes

---

### DayActivities

**File:** `/components/trip/DayActivities.tsx`

**Props:**
```typescript
interface DayActivitiesProps {
  planVersionId: string;
  dayId: string;
  dayLocation: string;
  currencySymbol: string;
  onActivitiesChanged?: () => void;
}
```

**State:**
- `activities: Activity[]`
- `loading: boolean`
- `showAdd: boolean`
- `editingId: string | null`
- Form fields: name, timeStart, timeEnd, location, cost, notes

**Features:**
- Activity list with time, location, cost
- Status cycling (not_booked -> booked -> confirmed)
- Drag handle indicators
- Inline add/edit form
- Delete with confirmation
- Total costs calculation

---

### BookingChecklist

**File:** `/components/trip/BookingChecklist.tsx` (~800 lines)

**Props:**
```typescript
interface BookingChecklistProps {
  planVersionId: string;
  planName: string;
  currencySymbol: string;
  accommodations: Accommodation[];
  transport: Transport[];
  costs: Cost[];
}
```

**State:**
- `items: ChecklistItem[]`
- `loading: boolean`
- `showForm: boolean`
- `editingId: string | null`
- `form: FormData` - All checklist item fields
- `seeding: boolean`
- `saving: boolean`
- `expandedNotes: Set<string>`

**Features:**
- Track bookings and payments
- Categories with color coding
- Status cycling (not_booked -> booked -> confirmed)
- Payment type options (full, deposit, on_arrival, free)
- Payment progress tracking
- Payment due dates
- Booking references and URLs
- **Seed from Plan** - Auto-populate from existing items
- Inline notes editing

**CRITICAL:** This component manages user-curated data. Never auto-delete items.

---

### ResearchChat

**File:** `/components/trip/ResearchChat.tsx`

**Props:**
```typescript
interface ResearchChatProps {
  tripId: string;
  planVersionId: string | null;
  destination?: string | null;
}
```

**State:**
- `messages: ChatMessage[]`
- `input: string`
- `queryType: ResearchType`
- `loading: boolean`
- `addingToPlan: string | null`
- `addedItems: Set<string>`

**Features:**
- Query type selector (general, hotel, activity, restaurant, transport)
- Chat-style message display
- AI suggestions with pros/cons
- "Add to Plan" buttons
- Quick prompt suggestions
- Loading states
- Cached result indicators

---

### AiInsights

**File:** `/components/trip/AiInsights.tsx`

**Props:**
```typescript
interface AiInsightsProps {
  tripId: string;
  plans: PlanVersion[];
  activePlanId: string;
  days: ItineraryDay[];
  accommodations: Accommodation[];
  transport: Transport[];
  costs: Cost[];
  decisions: Decision[];
}
```

**State:**
- `activeTab: 'suggestions' | 'compare' | 'optimise'`
- `expanded: boolean`
- Suggestion/Compare/Optimise states (result, loading, error)

**Features:**
- Three tabs: Suggestions, Compare, Optimise
- Predefined suggestion prompts
- Multi-plan comparison analysis
- Cost optimization tips
- Error handling with retry
- Collapsible container

---

### ChangeSheet

**File:** `/components/trip/ChangeSheet.tsx` (~1000 lines)

**Props:**
```typescript
interface ChangeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => void;
  tripId: string;
  planVersionId: string;
  currencySymbol: string;
  destination?: string | null;
  itemType: 'accommodation' | 'transport' | 'cost' | 'itinerary_day';
  existingItem?: any;
  allDays?: ItineraryDay[];
}
```

**State:**
- `mode: 'actions' | 'chat' | 'edit' | 'link'`
- `messages: ChatMessage[]`
- `chatInput: string`
- `chatLoading: boolean`
- `editForm: Record<string, any>`
- `linkUrl: string`
- `extracting: boolean`
- `extractedData: Record<string, any> | null`
- `applying: boolean`
- `confirmRemove: boolean`
- `error: string | null`

**Features:**
- Modal sheet for item management
- Four modes: Actions, Chat, Edit, Link
- AI-powered suggestions with options
- Manual form editing
- Link scraping for booking details
- Database CRUD operations
- Push notifications on changes
- Form validation

---

### ShareModal

**File:** `/components/trip/ShareModal.tsx`

**Props:**
```typescript
interface ShareModalProps {
  tripId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**State:**
- `shares: TripShare[]`
- `email: string`
- `permission: 'view' | 'edit' | 'admin'`
- `loading, sending, error`

**Features:**
- Email invitation form
- Permission level selector
- List of shared users
- Update/remove permissions
- Pending invitation indicator

---

### ExportButton

**File:** `/components/trip/ExportButton.tsx`

**Props:**
```typescript
interface ExportButtonProps {
  tripId: string;
  tripName: string;
}
```

**Features:**
- PDF export
- Public share link generation
- Copy URL to clipboard
- Revoke share link

---

### TravelDocsHub

**File:** `/components/trip/TravelDocsHub.tsx`

**Props:**
```typescript
interface TravelDocsHubProps {
  tripId: string;
  tripStartDate?: string | null;
}
```

**Features:**
- Traveller management (passport, nationality, ESTA)
- Passport expiry warnings (6 months)
- Travel insurance policies
- Emergency contacts
- Child vs adult distinction

---

### DocumentsTab

**File:** `/components/trip/DocumentsTab.tsx`

**Props:**
```typescript
interface DocumentsTabProps {
  tripId: string;
}
```

**Features:**
- Drag-and-drop file upload
- Document grouping by type
- File type icons
- Image thumbnails
- Download links
- Max 10MB per file

---

### PackingList

**File:** `/components/trip/PackingList.tsx`

**Props:**
```typescript
interface PackingListProps {
  tripId: string;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}
```

**Features:**
- 8 categories with emoji icons
- Progress bar (packed/total)
- Manual item addition
- AI packing list generation
- Toggle packed status
- Collapsible categories

---

### CostBreakdown

**File:** `/components/trip/CostBreakdown.tsx`

**Props:**
```typescript
interface CostBreakdownProps {
  costs: Cost[];
  plan: PlanVersion;
  days: ItineraryDay[];
}
```

**Features:**
- Donut and bar chart views (Recharts)
- Category breakdown
- Payment status visualization
- Per-day cost chart
- Payment progress metrics

---

### CurrencyWidget

**File:** `/components/trip/CurrencyWidget.tsx`

**Props:**
```typescript
interface CurrencyWidgetProps {
  homeCurrency?: string;
  tripCurrency?: string;
}
```

**Features:**
- Fixed position bottom-right
- Currency conversion
- Swap currencies button
- Quick amount buttons
- 13 major currencies supported

---

### TripMap / TripMapInner

**File:** `/components/trip/TripMap.tsx`, `/components/trip/TripMapInner.tsx`

**Props:**
```typescript
interface TripMapProps {
  locations: TripMapLocation[];
  onLocationSelect?: (location: TripMapLocation | null) => void;
  className?: string;
}
```

**Features:**
- Leaflet map with OpenStreetMap tiles
- Custom colored markers
- Route polylines between locations
- Auto-fit bounds
- Floating legend
- Selection detail panel
- SSR disabled (dynamic import)

---

### JourneyOverview

**File:** `/components/trip/JourneyOverview.tsx`

**Props:**
```typescript
interface JourneyOverviewProps {
  days: ItineraryDay[];
}
```

**Features:**
- Horizontal scroll visualization
- Location grouping
- Night counts
- Connecting lines
- Home icon at end

---

### CommentThread

**File:** `/components/trip/CommentThread.tsx`

**Props:**
```typescript
interface CommentThreadProps {
  tripId: string;
  itemType: string;
  itemId: string;
  userEmail?: string;
}
```

**Features:**
- Expandable comment thread
- Comment count badge
- Add comments with Enter key
- Delete comments (hover reveal)
- Auto-scroll to bottom

---

### Timeline

**File:** `/components/trip/Timeline.tsx`

**Props:**
```typescript
interface TimelineProps {
  days: ItineraryDay[];
  selectedDayId: string | null;
  onSelectDay: (dayId: string) => void;
}
```

**Features:**
- Horizontal scrollable bar
- Color-coded day bars
- Hover tooltips
- Transit day patterns
- Date labels
- Location legend

---

### DayCard

**File:** `/components/trip/DayCard.tsx`

**Props:**
```typescript
interface DayCardProps {
  day: ItineraryDay;
  accommodation?: Accommodation;
}
```

**Features:**
- Single day itinerary card
- Day number, location, date, and icon
- Activity list with bullet points
- Drive time badge
- Associated accommodation info
- Activity cost indicators
- Used by DayCardGrid for expanded view

---

## Utility Functions

### Push Notification Utilities

**File:** `/lib/push-utils.ts`

```typescript
// Hook for managing push subscription
export function usePushSubscription(): {
  isSubscribed: boolean;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// Function to send push notification (server-side)
export async function sendPushNotification(options: {
  title: string;
  message: string;
  excludeUserId?: string;
}): Promise<number>  // Returns count of notifications sent
```

**Usage in Components:**
```typescript
import { sendPushNotification } from '@/lib/push-utils';

// After making changes that others should know about
await sendPushNotification({
  title: 'Trip Updated',
  message: `Changes made to ${tripName}`,
  excludeUserId: currentUserId  // Don't notify the person who made changes
});
```

---

## Type Exports

**File:** `/lib/supabase.ts`

The following types are exported for use throughout the app:

```typescript
export type { Database } from './database.types';

// Convenience type aliases
export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];
export type Traveller = Database['public']['Tables']['travellers']['Row'];
export type TravelInsurance = Database['public']['Tables']['travel_insurance']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type PackingItem = Database['public']['Tables']['packing_items']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type Activity = Database['public']['Tables']['activities']['Row'];
```

---

## Shared Patterns

### State Management
- All components use React hooks (useState, useCallback, useMemo, useRef)
- No global state management (Redux, Zustand)
- Data fetched via fetch() API calls

### Data Fetching
```typescript
useEffect(() => {
  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/endpoint?param=${value}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }
  loadData();
}, [dependency]);
```

### Push Notifications
```typescript
import { sendPushNotification } from '@/lib/push-utils';

// After data changes
await sendPushNotification({
  title: 'Trip Updated',
  message: `Changes made to ${tripName}`,
  excludeUserId: currentUserId
});
```

### Form Handling
- Inline forms within components
- Validation on submit
- Loading states during API calls
- Error message display

### Styling
- Tailwind CSS utility classes
- Responsive breakpoints (sm, md, lg, xl)
- Dark mode not implemented
- lucide-react for icons
