import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

/**
 * GET /api/plan-versions
 * List plan versions for a trip
 * Query params: trip_id (required)
 */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get('trip_id');

  if (!tripId) {
    return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
  }

  // RLS will ensure user has access to the trip
  const { data, error } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[API] GET /api/plan-versions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/plan-versions
 * Create a new plan version
 */
export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { trip_id, name, description, is_active, currency, color } = body;

  if (!trip_id || typeof trip_id !== 'string') {
    return NextResponse.json({ error: 'trip_id is required' }, { status: 400 });
  }

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // If setting as active, deactivate other plans first
  if (is_active === true) {
    await supabase
      .from('plan_versions')
      .update({ is_active: false })
      .eq('trip_id', trip_id);
  }

  const { data, error } = await supabase
    .from('plan_versions')
    .insert({
      trip_id: trip_id as string,
      name: name as string,
      description: description as string | undefined,
      is_active: is_active as boolean | undefined,
      currency: (currency as string) || 'GBP',
      color: (color as string) || '#3b82f6',
    })
    .select()
    .single();

  if (error) {
    console.error('[API] POST /api/plan-versions error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
