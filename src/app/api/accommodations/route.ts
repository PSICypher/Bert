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
      .from('accommodations')
      .select('*')
      .eq('plan_version_id', planVersionId)
      .order('check_in', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching accommodations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accommodations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const body = await request.json();

    // Calculate nights if check_in and check_out are provided
    if (body.check_in && body.check_out) {
      const checkIn = new Date(body.check_in);
      const checkOut = new Date(body.check_out);
      body.nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    }

    const { data, error } = await supabase
      .from('accommodations')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating accommodation:', error);
    return NextResponse.json(
      { error: 'Failed to create accommodation' },
      { status: 500 }
    );
  }
}
