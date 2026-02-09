# AI Integration

## Overview

The Holiday Planner App integrates with Anthropic's Claude API to provide:

- Travel research assistance
- Trip plan generation
- Plan comparison analysis
- Cost optimization recommendations
- Itinerary suggestions
- Web content extraction
- Packing list generation

---

## Configuration

**Model:** `claude-sonnet-4-20250514`

**Environment Variable:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...  # Server-side only
```

**SDK:** `@anthropic-ai/sdk` v0.14.0

---

## Core Functions

### 1. conductResearch()

**Purpose:** General travel research with context awareness

**Max Tokens:** 2000

**System Prompt:**
```
You are a travel research assistant helping plan a family holiday.
Provide specific, actionable recommendations with:
- Names of actual places/businesses
- Approximate costs in GBP
- Pros and cons
- Booking tips
- Family-friendliness ratings

Be concise but thorough. Format responses with clear sections.
```

**Parameters:**
```typescript
interface ResearchRequest {
  type: 'hotel' | 'activity' | 'restaurant' | 'transport' | 'general';
  query: string;
  location?: string;
  dateRange?: { start: string; end: string };
  budget?: { min: number; max: number; currency: string };
  preferences?: string[];
}
```

---

### 2. comparePlans()

**Purpose:** Analyze and compare multiple holiday plan versions

**Max Tokens:** 1500

**System Prompt:**
```
You are a travel planning expert. Analyze these holiday plan options and provide:
1. Key differences summary
2. Cost analysis (what you get for the money)
3. Experience quality comparison
4. Practical considerations (driving time, stress levels, flexibility)
5. Recommendation based on value for money

Be objective and highlight trade-offs clearly.
```

---

### 3. getItinerarySuggestions()

**Purpose:** Contextual suggestions for improving existing itineraries

**Max Tokens:** 1000

**System Prompt:**
```
You are a travel planning assistant. Based on the current itinerary,
provide helpful suggestions. Consider:
- Timing and logistics
- Family-friendliness (travelling with teenagers)
- Value for money
- Local knowledge and hidden gems
- Practical tips

Keep suggestions specific and actionable.
```

---

### 4. getCostOptimisationTips()

**Purpose:** Analyze costs and provide specific savings opportunities

**Max Tokens:** 1500

**System Prompt:**
```
You are a travel budget optimisation expert. Analyse the holiday cost breakdown and provide:
1. Specific savings opportunities with estimated amounts in [CURRENCY]
2. Alternative options that maintain quality
3. Timing-based savings (booking windows, off-peak dates, early-bird deals)
4. Category-by-category recommendations
5. A prioritised list of top 3-5 actions ranked by savings potential

Be specific with numbers. Reference actual items from the breakdown.
Format with clear headings and bullet points.
```

---

### 5. planChangeResearch()

**Purpose:** Provide alternatives for changing trip items (multi-turn conversation)

**Max Tokens:** 3000

**Response Format:** Structured JSON

**System Prompt:**
```
You are helping modify a family holiday plan. The user wants to change a specific item.

When suggesting alternatives:
1. Suggest 2-4 concrete alternatives with pros/cons
2. Include estimated costs in GBP (£)
3. For each option, provide an "applyData" object matching the database schema

IMPORTANT: Respond with valid JSON in this format:
{
  "text": "Your explanation...",
  "options": [
    {
      "name": "Option name",
      "type": "accommodation",
      "cost": 123,
      "currency": "GBP",
      "location": "Location",
      "description": "Description",
      "pros": ["Pro 1"],
      "cons": ["Con 1"],
      "applyData": { ... }
    }
  ]
}
```

---

### 6. extractFromUrl()

**Purpose:** Extract structured booking data from webpage content

**Max Tokens:** 1500

**Extracts By Type:**
- **Accommodation:** name, type, location, check_in, check_out, cost, amenities
- **Transport:** type, provider, dates, times, cost, reference
- **Cost:** category, item, amount, currency
- **Itinerary Day:** location, activities, notes, drive_time

---

### 7. generateTripPlan()

**Purpose:** Generate complete AI-powered trip plans

**Max Tokens:** 4000

**Returns:**
```typescript
{
  days: Array<{
    day_number: number;
    date: string;
    location: string;
    location_coordinates: { lat: number; lng: number } | null;
    icon: string;
    color: string;
    activities: Array<{ name: string; time?: string; cost?: number }>;
    notes: string | null;
    drive_time: string | null;
  }>;
  accommodations: Array<{ name, type, location, check_in, check_out, cost, notes }>;
  transport: Array<{ type, provider, details, cost, date }>;
  estimated_costs: Array<{ category, item, amount }>;
}
```

---

### 8. generatePackingList()

**Purpose:** Generate destination-specific packing lists

**Max Tokens:** 2000

**Returns:** `Array<{ category: string; name: string; quantity: number }>`

**Categories:** Clothes, Toiletries, Electronics, Documents, Kids, Beach/Pool, Medications, Misc

---

## API Endpoints

### POST /api/ai/research

```typescript
// Request
{
  "query": "Best family hotels near Universal Orlando",
  "type": "hotel",
  "trip_id": "uuid",
  "location": "Orlando",
  "date_range": { "start": "2026-05-19", "end": "2026-06-08" },
  "budget": { "min": 100, "max": 300, "currency": "GBP" },
  "preferences": ["family-friendly", "pool"]
}

// Response
{
  "result": {
    "text": "Here are my recommendations...",
    "suggestions": [
      {
        "name": "Loews Royal Pacific Resort",
        "cost": 250,
        "costRange": { "min": 200, "max": 300 },
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

### POST /api/ai/compare

```typescript
// Request
{ "trip_id": "uuid" }

// Response
{
  "result": "Comparison analysis text...",
  "cached": false
}
```

### POST /api/ai/optimise

```typescript
// Request
{
  "trip_id": "uuid",
  "plan_version_id": "uuid"
}

// Response
{
  "result": "Cost optimization recommendations...",
  "cached": false
}
```

### POST /api/ai/plan-change

```typescript
// Request
{
  "trip_id": "uuid",
  "plan_version_id": "uuid",
  "item_type": "accommodation",
  "current_item": { ... },
  "change_request": "Find a cheaper alternative",
  "conversation_history": [],
  "destination": "Florida"
}

// Response
{
  "result": {
    "text": "Here are alternatives...",
    "options": [ ... ]
  },
  "cached": false
}
```

### POST /api/ai/suggestions

```typescript
// Request
{
  "trip_id": "uuid",
  "plan_version_id": "uuid",
  "request": "Suggest where to add rest days"
}
```

### POST /api/ai/extract-link

```typescript
// Request
{
  "url": "https://booking.com/hotel/...",
  "item_type": "accommodation"
}

// Response
{
  "extracted": { ... structured data ... },
  "source_url": "https://..."
}
```

### POST /api/ai/generate-plan

```typescript
// Request
{
  "destination": "Florida, USA",
  "startDate": "2026-05-19",
  "endDate": "2026-06-08",
  "travellerCount": 4,
  "preferences": "Family with teenagers"
}
```

### POST /api/ai/generate-packing

```typescript
// Request
{
  "destination": "Florida, USA",
  "startDate": "2026-05-19",
  "endDate": "2026-06-08",
  "travellerCount": 4,
  "activities": ["theme parks", "beach"]
}
```

### POST /api/ai/add-to-plan

```typescript
// Request
{
  "plan_version_id": "uuid",
  "trip_id": "uuid",
  "suggestion_type": "accommodation",
  "data": {
    "name": "Hotel Name",
    "cost": 200,
    "location": "Orlando",
    "pros": ["Pro 1"],
    "cons": ["Con 1"]
  }
}
```

---

## Caching Strategy

**Cache Table:** `ai_research_cache`

```sql
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
```

**Expiry Policies:**

| Operation | Duration | Key Strategy |
|-----------|----------|--------------|
| Research | 24 hours | trip_id + query + type |
| Comparison | 1 hour | trip_id + plan_ids |
| Optimization | 6 hours | trip_id + plan_version_id |
| Plan Change | 24 hours | item_type + request (initial only) |
| Suggestions | 24 hours | trip_id + request |

**Cache Lookup:**
```typescript
const { data: cached } = await supabase
  .from('ai_research_cache')
  .select('results')
  .eq('trip_id', tripId)
  .eq('query', query.trim())
  .eq('query_type', queryType)
  .gt('expires_at', new Date().toISOString())
  .maybeSingle();

if (cached) {
  return { result: cached.results, cached: true };
}
```

---

## Response Parsing

**Suggestion Parser Function:**

```typescript
function parseStructuredSuggestions(text: string): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Split by numbered items or bold headers
  const sections = text.split(/(?=\d+\.\s|\*\*[^*]+\*\*)/);

  for (const section of sections) {
    // Extract name (first bold text or first line)
    const nameMatch = section.match(/\*\*([^*]+)\*\*/);
    const name = nameMatch?.[1] || section.split('\n')[0].trim();

    // Extract cost (£123, £100-200)
    const costMatch = section.match(/£(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const cost = costMatch ? parseFloat(costMatch[1].replace(',', '')) : undefined;

    // Extract pros (-, •, ✓, ✅ markers)
    const pros = section.match(/(?:[-•✓✅])\s*(?:Pro|Pros|Advantage|Good):\s*(.+)/gi);

    // Extract cons
    const cons = section.match(/(?:[-•✗❌])\s*(?:Con|Cons|Disadvantage|Bad):\s*(.+)/gi);

    if (name) {
      suggestions.push({ name, cost, pros, cons });
    }
  }

  return suggestions.slice(0, 8);  // Max 8 suggestions
}
```

---

## Token Limits Summary

| Function | Max Tokens | Context |
|----------|-----------|---------|
| conductResearch | 2000 | Location, dates, budget |
| comparePlans | 1500 | Plan data (costs, accommodations) |
| getItinerarySuggestions | 1000 | Full itinerary + request |
| getCostOptimisationTips | 1500 | Cost breakdown by category |
| planChangeResearch | 3000 | Current item + conversation |
| extractFromUrl | 1500 | Plain text from webpage |
| generateTripPlan | 4000 | Destination, dates, travellers |
| generatePackingList | 2000 | Destination, dates, activities |

---

## Error Handling

```typescript
try {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
    system: systemPrompt,
  });

  return response.content[0].text;
} catch (error) {
  console.error('Claude API error:', error);
  throw new Error('AI research failed');
}
```

---

## UI Components

### ResearchChat

- Query type selector tabs
- Chat-style message display
- Suggestion cards with pros/cons
- "Add to Plan" buttons
- Loading states
- Cached result indicators

### AiInsights

- Three tabs: Suggestions, Compare, Optimise
- Predefined prompts for suggestions
- Multi-plan comparison
- Cost analysis display

### ChangeSheet

- AI chat mode for item changes
- Option cards with applyData
- Link extraction mode
- Apply suggestion workflow
