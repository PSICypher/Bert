import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { generateTripPlan } from '@/lib/ai/anthropic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      destination,
      startDate,
      endDate,
      travellerCount,
      preferences,
    } = body;

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'destination, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (end <= start) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Generate plan using AI
    const plan = await generateTripPlan(
      destination,
      startDate,
      endDate,
      travellerCount || 2,
      preferences || ''
    );

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('AI generate-plan error:', error);
    return NextResponse.json(
      { error: 'Plan generation failed' },
      { status: 500 }
    );
  }
}
