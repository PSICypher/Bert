import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = 'claude-sonnet-4-5-20250929';

// ============================================================================
// Types
// ============================================================================

export interface ResearchRequest {
  type: 'hotel' | 'activity' | 'restaurant' | 'transport' | 'general';
  query: string;
  location?: string;
  dateRange?: { start: string; end: string };
  budget?: { min: number; max: number; currency: string };
  preferences?: string[];
}

export interface Suggestion {
  name: string;
  cost?: number;
  costRange?: { min: number; max: number };
  location?: string;
  description?: string;
  pros?: string[];
  cons?: string[];
}

export interface ResearchResult {
  text: string;
  suggestions: Suggestion[];
}

export interface PlanChangeOption {
  name: string;
  type: string;
  cost: number;
  currency: string;
  location: string;
  description: string;
  pros: string[];
  cons: string[];
  applyData: Record<string, unknown>;
}

export interface PlanChangeResult {
  text: string;
  options: PlanChangeOption[];
}

export interface GeneratedDay {
  day_number: number;
  date: string;
  location: string;
  location_coordinates: { lat: number; lng: number } | null;
  icon: string;
  color: string;
  activities: Array<{ name: string; time?: string; cost?: number }>;
  notes: string | null;
  drive_time: string | null;
}

export interface GeneratedAccommodation {
  name: string;
  type: string;
  location: string;
  check_in: string;
  check_out: string;
  cost: number;
  notes?: string;
}

export interface GeneratedTransport {
  type: string;
  provider: string;
  details: string;
  cost: number;
  date: string;
}

export interface GeneratedCost {
  category: string;
  item: string;
  amount: number;
}

export interface GeneratedPlan {
  days: GeneratedDay[];
  accommodations: GeneratedAccommodation[];
  transport: GeneratedTransport[];
  estimated_costs: GeneratedCost[];
}

export interface PackingItem {
  category: string;
  name: string;
  quantity: number;
  linkedTo?: string;
}

export interface ItineraryContext {
  days: Array<{
    day_number: number;
    date: string | null;
    location: string;
    activities: Array<{ name: string; time?: string }>;
  }>;
  transport: Array<{
    type: string;
    provider: string;
    details: string;
    pickup_location?: string;
    dropoff_location?: string;
  }>;
  accommodations: Array<{
    name: string;
    type: string;
    location: string;
    check_in: string;
    check_out: string;
  }>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================================================
// System Prompts
// ============================================================================

const RESEARCH_SYSTEM_PROMPT = `You are a travel research assistant helping plan a family holiday.
Provide specific, actionable recommendations with:
- Names of actual places/businesses
- Approximate costs in GBP
- Pros and cons
- Booking tips
- Family-friendliness ratings

Be concise but thorough. Format responses with clear sections.`;

const COMPARE_SYSTEM_PROMPT = `You are a travel planning expert. Analyze these holiday plan options and provide:
1. Key differences summary
2. Cost analysis (what you get for the money)
3. Experience quality comparison
4. Practical considerations (driving time, stress levels, flexibility)
5. Recommendation based on value for money

Be objective and highlight trade-offs clearly.`;

const SUGGESTIONS_SYSTEM_PROMPT = `You are a travel planning assistant. Based on the current itinerary,
provide helpful suggestions. Consider:
- Timing and logistics
- Family-friendliness (travelling with teenagers)
- Value for money
- Local knowledge and hidden gems
- Practical tips

Keep suggestions specific and actionable.`;

const OPTIMISE_SYSTEM_PROMPT = `You are a travel budget optimisation expert. Analyse the holiday cost breakdown and provide:
1. Specific savings opportunities with estimated amounts in the specified currency
2. Alternative options that maintain quality
3. Timing-based savings (booking windows, off-peak dates, early-bird deals)
4. Category-by-category recommendations
5. A prioritised list of top 3-5 actions ranked by savings potential

Be specific with numbers. Reference actual items from the breakdown.
Format with clear headings and bullet points.`;

const PLAN_CHANGE_SYSTEM_PROMPT = `You are helping modify a family holiday plan. The user wants to change a specific item.

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
}`;

const EXTRACT_SYSTEM_PROMPT = `You are a data extraction assistant. Extract structured booking information from the provided webpage content.
Return valid JSON matching the requested item type schema.`;

const GENERATE_PLAN_SYSTEM_PROMPT = `You are a travel planning expert. Generate a complete holiday itinerary based on the requirements.
Return valid JSON with days, accommodations, transport, and estimated costs.
Use realistic prices in GBP. Include specific place names and coordinates where possible.`;

const GENERATE_PACKING_SYSTEM_PROMPT = `You are a packing list expert. Generate a comprehensive packing list for the specified trip.
Return valid JSON array with items categorized appropriately.
Categories: Clothes, Toiletries, Electronics, Documents, Kids, Beach/Pool, Medications, Misc

Each item should include an optional "linkedTo" field describing which activity/day it's for (e.g. "Day 5: Bahamas boat trip").
Only include linkedTo for items tied to specific activities — generic items like "Underwear" should omit it.

Pay special attention to:
- Transport types (boat trips need seasickness pills, flights need neck pillows, etc.)
- Accommodation types (beach resort vs city hotel changes what to pack)
- Specific activities mentioned in the itinerary
- Weather and location considerations
- Travel documents needed for the destinations`;

// ============================================================================
// Helper Functions
// ============================================================================

function parseStructuredSuggestions(text: string): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const sections = text.split(/(?=\d+\.\s|\*\*[^*]+\*\*)/);

  for (const section of sections) {
    if (!section.trim()) continue;

    const nameMatch = section.match(/\*\*([^*]+)\*\*/);
    const name = nameMatch?.[1] || section.split('\n')[0].replace(/^\d+\.\s*/, '').trim();
    if (!name || name.length < 3) continue;

    const costMatch = section.match(/£(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const cost = costMatch ? parseFloat(costMatch[1].replace(',', '')) : undefined;

    const costRangeMatch = section.match(/£(\d+)\s*-\s*£?(\d+)/);
    const costRange = costRangeMatch
      ? { min: parseInt(costRangeMatch[1]), max: parseInt(costRangeMatch[2]) }
      : undefined;

    const locationMatch = section.match(/(?:Location|Located|Area):\s*([^\n]+)/i);
    const location = locationMatch?.[1]?.trim();

    const prosMatches = section.match(/(?:[-•✓✅]\s*)(?:Pro|Advantage|Good)s?:\s*([^\n]+)/gi) || [];
    const pros = prosMatches.map(m => m.replace(/^[-•✓✅]\s*(?:Pro|Advantage|Good)s?:\s*/i, '').trim());

    const consMatches = section.match(/(?:[-•✗❌]\s*)(?:Con|Disadvantage|Bad)s?:\s*([^\n]+)/gi) || [];
    const cons = consMatches.map(m => m.replace(/^[-•✗❌]\s*(?:Con|Disadvantage|Bad)s?:\s*/i, '').trim());

    suggestions.push({
      name,
      cost,
      costRange,
      location,
      pros: pros.length > 0 ? pros : undefined,
      cons: cons.length > 0 ? cons : undefined,
    });
  }

  return suggestions.slice(0, 8);
}

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

async function callClaudeWithHistory(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number
): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages,
  });

  const content = response.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }
  return content.text;
}

// ============================================================================
// Core AI Functions
// ============================================================================

export async function conductResearch(request: ResearchRequest): Promise<ResearchResult> {
  let prompt = `Research request type: ${request.type}\n\nQuery: ${request.query}`;

  if (request.location) {
    prompt += `\n\nLocation: ${request.location}`;
  }

  if (request.dateRange) {
    prompt += `\n\nDates: ${request.dateRange.start} to ${request.dateRange.end}`;
  }

  if (request.budget) {
    prompt += `\n\nBudget: ${request.budget.currency} ${request.budget.min} - ${request.budget.max}`;
  }

  if (request.preferences && request.preferences.length > 0) {
    prompt += `\n\nPreferences: ${request.preferences.join(', ')}`;
  }

  const text = await callClaude(RESEARCH_SYSTEM_PROMPT, prompt, 2000);
  const suggestions = parseStructuredSuggestions(text);

  return { text, suggestions };
}

export async function comparePlans(plansData: string): Promise<string> {
  const prompt = `Please compare these holiday plan options:\n\n${plansData}`;
  return callClaude(COMPARE_SYSTEM_PROMPT, prompt, 1500);
}

export async function getItinerarySuggestions(
  itineraryData: string,
  request: string
): Promise<string> {
  const prompt = `Current itinerary:\n${itineraryData}\n\nUser request: ${request}`;
  return callClaude(SUGGESTIONS_SYSTEM_PROMPT, prompt, 1000);
}

export async function getCostOptimisationTips(
  costData: string,
  currency: string
): Promise<string> {
  const systemPrompt = OPTIMISE_SYSTEM_PROMPT.replace('the specified currency', currency);
  const prompt = `Please analyze this cost breakdown and provide optimization tips:\n\n${costData}`;
  return callClaude(systemPrompt, prompt, 1500);
}

export async function planChangeResearch(
  itemType: string,
  currentItem: Record<string, unknown>,
  changeRequest: string,
  destination: string,
  conversationHistory: ConversationMessage[]
): Promise<PlanChangeResult> {
  const systemPrompt = PLAN_CHANGE_SYSTEM_PROMPT;

  const initialMessage = `I'm planning a trip to ${destination}.

Current ${itemType}:
${JSON.stringify(currentItem, null, 2)}

Change request: ${changeRequest}

Please suggest alternatives.`;

  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: initialMessage },
  ];

  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  const text = await callClaudeWithHistory(systemPrompt, messages, 3000);

  try {
    const parsed = JSON.parse(text);
    return {
      text: parsed.text || text,
      options: parsed.options || [],
    };
  } catch {
    return {
      text,
      options: [],
    };
  }
}

export async function extractFromUrl(
  pageContent: string,
  itemType: string
): Promise<Record<string, unknown>> {
  const schemaPrompts: Record<string, string> = {
    accommodation: `Extract: name, type (hotel/resort/villa/airbnb), location, address, check_in (date), check_out (date), cost (number), currency, amenities (array), booking_reference, notes`,
    transport: `Extract: type (car_rental/flight/train/bus/transfer), provider, vehicle, pickup_location, pickup_date, pickup_time, dropoff_location, dropoff_date, dropoff_time, cost, currency, booking_reference`,
    cost: `Extract: category (accommodation/transport/activities/food/tickets/misc), item (name), amount (number), currency, notes`,
    itinerary_day: `Extract: location, activities (array of {name, time, cost}), notes, drive_time`,
  };

  const prompt = `${schemaPrompts[itemType] || 'Extract relevant booking information.'}

Webpage content:
${pageContent}

Return valid JSON only, no explanation.`;

  const text = await callClaude(EXTRACT_SYSTEM_PROMPT, prompt, 1500);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return empty object if parsing fails
  }

  return {};
}

export async function generateTripPlan(
  destination: string,
  startDate: string,
  endDate: string,
  travellerCount: number,
  preferences: string
): Promise<GeneratedPlan> {
  const prompt = `Generate a complete holiday itinerary:

Destination: ${destination}
Dates: ${startDate} to ${endDate}
Travellers: ${travellerCount}
Preferences: ${preferences}

Return valid JSON with this structure:
{
  "days": [
    {
      "day_number": 1,
      "date": "YYYY-MM-DD",
      "location": "City/Area",
      "location_coordinates": {"lat": 0.0, "lng": 0.0},
      "icon": "emoji",
      "color": "#hex",
      "activities": [{"name": "Activity", "time": "09:00", "cost": 50}],
      "notes": "Optional notes",
      "drive_time": "~2 hrs"
    }
  ],
  "accommodations": [
    {
      "name": "Hotel Name",
      "type": "hotel",
      "location": "City",
      "check_in": "YYYY-MM-DD",
      "check_out": "YYYY-MM-DD",
      "cost": 200,
      "notes": "Optional"
    }
  ],
  "transport": [
    {
      "type": "car_rental",
      "provider": "Company",
      "details": "Vehicle type",
      "cost": 500,
      "date": "YYYY-MM-DD"
    }
  ],
  "estimated_costs": [
    {"category": "accommodation", "item": "Hotels", "amount": 1000}
  ]
}`;

  const text = await callClaude(GENERATE_PLAN_SYSTEM_PROMPT, prompt, 4000);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return empty plan if parsing fails
  }

  return {
    days: [],
    accommodations: [],
    transport: [],
    estimated_costs: [],
  };
}

export async function generatePackingList(
  destination: string,
  startDate: string,
  endDate: string,
  travellerCount: number,
  activities: string[],
  itinerary?: ItineraryContext
): Promise<PackingItem[]> {
  let prompt = `Generate a packing list:

Destination: ${destination}
Dates: ${startDate} to ${endDate}
Travellers: ${travellerCount}
Activities: ${activities.join(', ')}`;

  if (itinerary) {
    if (itinerary.days.length > 0) {
      prompt += `\n\nDetailed Itinerary:`;
      for (const day of itinerary.days) {
        const acts = day.activities.map(a => a.name).join(', ');
        prompt += `\n- Day ${day.day_number} (${day.date || 'TBD'}): ${day.location}${acts ? ` — ${acts}` : ''}`;
      }
    }

    if (itinerary.transport.length > 0) {
      prompt += `\n\nTransport:`;
      for (const t of itinerary.transport) {
        prompt += `\n- ${t.type}: ${t.provider} ${t.details}${t.pickup_location ? ` from ${t.pickup_location}` : ''}${t.dropoff_location ? ` to ${t.dropoff_location}` : ''}`;
      }
    }

    if (itinerary.accommodations.length > 0) {
      prompt += `\n\nAccommodations:`;
      for (const a of itinerary.accommodations) {
        prompt += `\n- ${a.name} (${a.type}) in ${a.location}, ${a.check_in} to ${a.check_out}`;
      }
    }
  }

  prompt += `

Return valid JSON array:
[
  {"category": "Clothes", "name": "T-shirts", "quantity": 7},
  {"category": "Beach/Pool", "name": "Snorkel gear", "quantity": 1, "linkedTo": "Day 5: Bahamas boat trip"}
]

Categories: Clothes, Toiletries, Electronics, Documents, Kids, Beach/Pool, Medications, Misc`;

  const text = await callClaude(GENERATE_PACKING_SYSTEM_PROMPT, prompt, 3000);

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Return empty array if parsing fails
  }

  return [];
}
