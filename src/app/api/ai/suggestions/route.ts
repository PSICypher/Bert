import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { getItinerarySuggestions } from '@/lib/ai/anthropic';
import { getCachedResult, setCachedResult, generateCacheKey } from '@/lib/ai/cache';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trip_id, plan_version_id, request: userRequest } = body;

    if (!trip_id || !plan_version_id || !userRequest) {
      return NextResponse.json(
        { error: 'trip_id, plan_version_id, and request are required' },
        { status: 400 }
      );
    }

    // Fetch itinerary data
    const { data: planVersion, error: planError } = await supabase
      .from('plan_versions')
      .select(`
        id,
        name,
        itinerary_days (
          id,
          day_number,
          date,
          location,
          notes,
          drive_time,
          activities (
            id,
            name,
            time_start,
            time_end,
            location,
            cost
          )
        ),
        accommodations (
          id,
          name,
          location,
          check_in,
          check_out
        )
      `)
      .eq('id', plan_version_id)
      .single();

    if (planError || !planVersion) {
      return NextResponse.json(
        { error: 'Plan version not found' },
        { status: 404 }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey({ trip_id, plan_version_id, request: userRequest });

    // Check cache
    const cached = await getCachedResult<string>(
      supabase,
      trip_id,
      cacheKey,
      'suggestions'
    );

    if (cached) {
      return NextResponse.json(cached);
    }

    // Format itinerary data
    const sortedDays = (planVersion.itinerary_days || []).sort(
      (a: { day_number: number }, b: { day_number: number }) => a.day_number - b.day_number
    );

    const itineraryData = sortedDays.map((day: {
      day_number: number;
      date?: string;
      location: string;
      drive_time?: string;
      notes?: string;
      activities?: Array<{
        name: string;
        time_start?: string;
        time_end?: string;
        location?: string;
        cost?: number;
      }>;
    }) => `
Day ${day.day_number} (${day.date || 'TBD'}): ${day.location}
${day.drive_time ? `Drive time: ${day.drive_time}` : ''}
Activities:
${day.activities?.map((a) =>
  `- ${a.time_start || '??:??'}-${a.time_end || '??:??'}: ${a.name}${a.location ? ` at ${a.location}` : ''}${a.cost ? ` (£${a.cost})` : ''}`
).join('\n') || '- No activities planned'}
${day.notes ? `Notes: ${day.notes}` : ''}`
    ).join('\n\n');

    const accommodationsInfo = planVersion.accommodations?.map((a: {
      name: string;
      location?: string;
      check_in: string;
      check_out: string;
    }) =>
      `- ${a.name} in ${a.location}: ${a.check_in} to ${a.check_out}`
    ).join('\n') || 'None booked';

    const fullItinerary = `
## ${planVersion.name}

### Accommodations:
${accommodationsInfo}

### Day-by-Day Itinerary:
${itineraryData}
`;

    // Get suggestions from AI
    const result = await getItinerarySuggestions(fullItinerary, userRequest);

    // Cache result
    await setCachedResult(
      supabase,
      trip_id,
      cacheKey,
      'suggestions',
      result
    );

    return NextResponse.json({ result, cached: false });
  } catch (error) {
    console.error('AI suggestions error:', error);
    return NextResponse.json(
      { error: 'Suggestions generation failed' },
      { status: 500 }
    );
  }
}
