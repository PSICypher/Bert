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
      .from('costs')
      .select('*')
      .eq('plan_version_id', planVersionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching costs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('costs')
      .insert(body)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating cost:', error);
    return NextResponse.json(
      { error: 'Failed to create cost' },
      { status: 500 }
    );
  }
}
