import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { planChangeResearch } from '@/lib/ai/anthropic';

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
      existing_item,
      destination,
      user_message
    } = body;

    if (!trip_id || !plan_version_id || !item_type || !user_message) {
      return NextResponse.json(
        { error: 'trip_id, plan_version_id, item_type, and user_message are required' },
        { status: 400 }
      );
    }

    // Use the planChangeResearch function with empty conversation history for now
    const result = await planChangeResearch(
      item_type,
      existing_item || {},
      user_message,
      destination || 'the destination',
      [] // conversation history - could be expanded later
    );

    // Transform the response to match what ChangeSheet expects
    return NextResponse.json({
      response: result.text,
      options: result.options.map(opt => ({
        id: crypto.randomUUID(),
        name: opt.name,
        description: opt.description,
        cost: opt.cost,
        data: opt.applyData,
      })),
    });
  } catch (error) {
    console.error('AI change-suggest error:', error);
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}
