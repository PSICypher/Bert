import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { conductResearch, type ResearchRequest } from '@/lib/ai/anthropic';
import { getCachedResult, setCachedResult, generateCacheKey } from '@/lib/ai/cache';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      query,
      type,
      trip_id,
      location,
      date_range,
      budget,
      preferences,
    } = body;

    if (!query || !type) {
      return NextResponse.json(
        { error: 'Query and type are required' },
        { status: 400 }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey({
      query,
      type,
      location,
      date_range,
      budget,
      preferences,
    });

    // Check cache
    const cached = await getCachedResult(
      supabase,
      trip_id || null,
      cacheKey,
      'research'
    );

    if (cached) {
      return NextResponse.json(cached);
    }

    // Conduct research
    const researchRequest: ResearchRequest = {
      type,
      query,
      location,
      dateRange: date_range,
      budget,
      preferences,
    };

    const result = await conductResearch(researchRequest);

    // Cache result
    await setCachedResult(
      supabase,
      trip_id || null,
      cacheKey,
      'research',
      result
    );

    return NextResponse.json({ result, cached: false });
  } catch (error) {
    console.error('AI research error:', error);
    return NextResponse.json(
      { error: 'AI research failed' },
      { status: 500 }
    );
  }
}
