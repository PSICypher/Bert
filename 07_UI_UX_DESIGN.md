# UI/UX Design

## Design System

### Colors

**Primary Palette:**
```css
--purple-600: #9333EA;  /* Primary accent */
--purple-500: #A855F7;  /* Hover state */
--purple-100: #F3E8FF;  /* Light background */

--blue-600: #2563EB;    /* Links, info */
--blue-500: #3B82F6;    /* Hover */

--green-600: #16A34A;   /* Success, confirmed */
--green-500: #22C55E;   /* Hover */

--yellow-500: #EAB308;  /* Warning, pending */
--red-600: #DC2626;     /* Error, delete */
```

**Category Colors:**
```css
/* Checklist & Cost Categories */
--accommodation: #8B5CF6;  /* Purple */
--transport: #3B82F6;      /* Blue */
--activities: #10B981;     /* Emerald */
--tickets: #F59E0B;        /* Amber */
--food: #EC4899;           /* Pink */
--misc: #6B7280;           /* Gray */
```

**Plan Version Colors:**
```css
--plan-a: #8B5CF6;  /* Purple */
--plan-b: #10B981;  /* Emerald */
--plan-c: #F59E0B;  /* Amber */
--plan-d: #EF4444;  /* Red */
```

### Typography

```css
/* Font Stack */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;

/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
```

### Spacing

```css
/* Consistent spacing scale */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
```

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
```

---

## Responsive Breakpoints

```css
/* Tailwind CSS Breakpoints */
sm: 640px   /* Small devices */
md: 768px   /* Tablets */
lg: 1024px  /* Laptops */
xl: 1280px  /* Desktops */
2xl: 1536px /* Large screens */
```

### Mobile-First Approach

```jsx
// Example: Grid that scales
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>
```

---

## Component Patterns

### Cards

```jsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
  <h3 className="font-semibold text-gray-900">{title}</h3>
  <p className="text-sm text-gray-600 mt-1">{description}</p>
</div>
```

### Buttons

**Primary:**
```jsx
<button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
  Save Changes
</button>
```

**Secondary:**
```jsx
<button className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors">
  Cancel
</button>
```

**Danger:**
```jsx
<button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
  Delete
</button>
```

**Icon Button:**
```jsx
<button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
  <Pencil className="w-4 h-4 text-gray-600" />
</button>
```

### Status Badges

```jsx
// Booking Status
<span className={cn(
  "px-2 py-1 rounded-full text-xs font-medium",
  status === 'confirmed' && "bg-green-100 text-green-700",
  status === 'booked' && "bg-yellow-100 text-yellow-700",
  status === 'not_booked' && "bg-gray-100 text-gray-600"
)}>
  {status}
</span>
```

### Form Inputs

```jsx
<input
  type="text"
  className="w-full px-3 py-2 border border-gray-300 rounded-lg
             focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
  placeholder="Enter value..."
/>
```

### Tabs

```jsx
<div className="border-b border-gray-200">
  <nav className="flex space-x-8">
    {tabs.map(tab => (
      <button
        key={tab.id}
        className={cn(
          "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
          activeTab === tab.id
            ? "border-purple-500 text-purple-600"
            : "border-transparent text-gray-500 hover:text-gray-700"
        )}
      >
        {tab.label}
      </button>
    ))}
  </nav>
</div>
```

---

## Page Layouts

### Dashboard (Trip List)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Logo + Sign Out                                      │
├─────────────────────────────────────────────────────────────┤
│ Title: Your Trips                              [+ New Trip]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│ │ Trip Card   │  │ Trip Card   │  │ Trip Card   │          │
│ │ [Image]     │  │ [Image]     │  │ [Image]     │          │
│ │ Name        │  │ Name        │  │ Name        │          │
│ │ Dates       │  │ Dates       │  │ Dates       │          │
│ │ Status      │  │ Status      │  │ Status      │          │
│ └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Trip Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ TripHeader: Name, Dates, Share, Export                       │
├─────────────────────────────────────────────────────────────┤
│ TripDashboardHeader: Key Metrics (Countdown, Budget, etc.)   │
├─────────────────────────────────────────────────────────────┤
│ PlanVersionTabs: [Plan A] [Plan B] [+]                       │
├─────────────────────────────────────────────────────────────┤
│ Tab Navigation: Overview | Research | Checklist | Docs | ... │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                     Tab Content Area                         │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                          [Currency Widget]   │
└─────────────────────────────────────────────────────────────┘
```

### Overview Tab Layout

```
┌─────────────────────────────────────────────────────────────┐
│ JourneyOverview: Horizontal scroll of locations              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐      │
│  │     Day Card Grid      │  │       Trip Map         │      │
│  │  (2/3 width on lg+)    │  │   (1/3 width on lg+)   │      │
│  │                        │  │                        │      │
│  │  Day 1  Day 2  Day 3   │  │      [Leaflet Map]     │      │
│  │  Day 4  Day 5  Day 6   │  │      with markers      │      │
│  │                        │  │                        │      │
│  └───────────────────────┘  └───────────────────────┘      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ SummaryCards: Budget | Accommodations | Transport | AI      │
├─────────────────────────────────────────────────────────────┤
│ CostBreakdown: Charts (Donut | Bar toggle)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns

### Loading States

```jsx
// Spinner
<div className="flex justify-center py-8">
  <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
</div>

// Skeleton
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

### Empty States

```jsx
<div className="text-center py-12">
  <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
    <Package className="w-6 h-6 text-gray-400" />
  </div>
  <h3 className="font-medium text-gray-900 mb-1">No items yet</h3>
  <p className="text-sm text-gray-500 mb-4">Get started by adding your first item</p>
  <button className="text-purple-600 hover:text-purple-700 font-medium">
    Add Item
  </button>
</div>
```

### Error States

```jsx
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
  <div className="flex items-start">
    <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 mr-3" />
    <div>
      <h4 className="font-medium text-red-800">Something went wrong</h4>
      <p className="text-sm text-red-600 mt-1">{error.message}</p>
      <button className="text-sm text-red-700 font-medium mt-2 hover:underline">
        Try again
      </button>
    </div>
  </div>
</div>
```

### Confirmation Dialogs

```jsx
{showConfirmDelete && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md mx-4">
      <h3 className="font-semibold text-lg mb-2">Delete Item?</h3>
      <p className="text-gray-600 mb-6">
        This action cannot be undone. Are you sure you want to delete this item?
      </p>
      <div className="flex justify-end space-x-3">
        <button onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
          Cancel
        </button>
        <button onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Delete
        </button>
      </div>
    </div>
  </div>
)}
```

---

## Mobile Considerations

### Touch Targets

- Minimum 44x44px for interactive elements
- Adequate spacing between clickable items
- Full-width buttons on mobile

### Navigation

- Bottom navigation consideration for mobile PWA
- Hamburger menu not currently implemented
- Tab bar scrolls horizontally on small screens

### Forms

- Large input fields (min 44px height)
- Clear labels above inputs
- Numeric keyboard for cost inputs (`inputMode="decimal"`)

---

## Accessibility

### ARIA Labels

```jsx
<button aria-label="Close modal" onClick={onClose}>
  <X className="w-5 h-5" />
</button>
```

### Focus Management

```jsx
// Auto-focus on modal open
useEffect(() => {
  if (isOpen) {
    inputRef.current?.focus();
  }
}, [isOpen]);
```

### Keyboard Navigation

- Tab navigation through interactive elements
- Escape to close modals
- Enter to submit forms

### Color Contrast

- Text meets WCAG AA standards
- Status colors have text labels, not just color

---

## Animation

### Transitions

```css
/* Standard transition */
transition: all 150ms ease-in-out;

/* Tailwind classes */
.transition-colors { transition: color, background-color 150ms; }
.transition-opacity { transition: opacity 150ms; }
.transition-transform { transition: transform 150ms; }
```

### Animations

```css
/* Spin animation for loaders */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.animate-spin { animation: spin 1s linear infinite; }

/* Pulse for skeletons */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
```

---

## Icons

**Library:** lucide-react

**Common Icons:**
```jsx
import {
  Plus, Trash2, Pencil, Check, X,
  ChevronDown, ChevronUp, ChevronRight,
  Loader2, AlertTriangle, Info,
  MapPin, Calendar, DollarSign,
  Plane, Car, Hotel, Ticket,
  Download, Share2, Copy,
  MessageCircle, Send,
  User, Mail, Lock
} from 'lucide-react';
```

**Icon Sizing:**
```jsx
// Small (inline text)
<Check className="w-4 h-4" />

// Medium (buttons)
<Plus className="w-5 h-5" />

// Large (empty states)
<Package className="w-12 h-12" />
```

---

## Dark Mode

**Not Currently Implemented**

Future consideration:
- Tailwind `dark:` variant classes
- System preference detection
- Manual toggle
- Store preference in localStorage
