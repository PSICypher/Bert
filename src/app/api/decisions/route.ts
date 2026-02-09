import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('tripId');
    const planVersionId = searchParams.get('planVersionId');

    if (!tripId) {
      return NextResponse.json(
        { error: 'tripId is required' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('decisions')
      .select('*')
      .eq('trip_id', tripId);

    if (planVersionId) {
      query = query.eq('plan_version_id', planVersionId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching decisions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('decisions')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating decision:', error);
    return NextResponse.json(
      { error: 'Failed to create decision' },
      { status: 500 }
    );
  }
}
