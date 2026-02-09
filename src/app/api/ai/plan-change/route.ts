import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { planChangeResearch, type ConversationMessage } from '@/lib/ai/anthropic';
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
      trip_id,
      plan_version_id,
      item_type,
      current_item,
      change_request,
      conversation_history = [],
      destination,
    } = body;

    if (!trip_id || !plan_version_id || !item_type || !current_item || !change_request) {
      return NextResponse.json(
        { error: 'Missing required fields: trip_id, plan_version_id, item_type, current_item, change_request' },
        { status: 400 }
      );
    }

    // Only cache initial requests (no conversation history)
    const isInitialRequest = conversation_history.length === 0;

    if (isInitialRequest) {
      const cacheKey = generateCacheKey({
        item_type,
        change_request,
        current_item_id: current_item.id,
      });

      const cached = await getCachedResult(
        supabase,
        trip_id,
        cacheKey,
        'plan_change'
      );

      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Get trip destination if not provided
    let tripDestination = destination;
    if (!tripDestination) {
      const { data: trip } = await supabase
        .from('trips')
        .select('destination')
        .eq('id', trip_id)
        .single();
      tripDestination = trip?.destination || 'Unknown';
    }

    // Get plan change suggestions
    const result = await planChangeResearch(
      item_type,
      current_item,
      change_request,
      tripDestination,
      conversation_history as ConversationMessage[]
    );

    // Cache initial request result
    if (isInitialRequest) {
      const cacheKey = generateCacheKey({
        item_type,
        change_request,
        current_item_id: current_item.id,
      });

      await setCachedResult(
        supabase,
        trip_id,
        cacheKey,
        'plan_change',
        result
      );
    }

    return NextResponse.json({ result, cached: false });
  } catch (error) {
    console.error('AI plan-change error:', error);
    return NextResponse.json(
      { error: 'Plan change research failed' },
      { status: 500 }
    );
  }
}
