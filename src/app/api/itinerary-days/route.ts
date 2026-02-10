import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { searchParams } = new URL(request.url);
    const planVersionId = searchParams.get('planVersionId');

    if (!planVersionId) {
      return NextResponse.json(
        { error: 'planVersionId is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('itinerary_days')
      .select('*')
      .eq('plan_version_id', planVersionId)
      .order('day_number', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching itinerary days:', error);
    return NextResponse.json(
      { error: 'Failed to fetch itinerary days' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('itinerary_days')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating itinerary day:', error);
    return NextResponse.json(
      { error: 'Failed to create itinerary day' },
      { status: 500 }
    );
  }
}
