import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

/**
 * GET /api/transport
 * List transport items for a plan version
 * Query params: plan_version_id (required)
 */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const planVersionId = searchParams.get('plan_version_id');

  if (!planVersionId) {
    return NextResponse.json({ error: 'plan_version_id is required' }, { status: 400 });
  }

  // RLS will ensure user has access
  const { data, error } = await supabase
    .from('transport')
    .select('*')
    .eq('plan_version_id', planVersionId)
    .order('pickup_date', { ascending: true });

  if (error) {
    console.error('[API] GET /api/transport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/transport
 * Create a transport item
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

  const {
    plan_version_id,
    type,
    provider,
    vehicle,
    reference_number,
    pickup_location,
    pickup_date,
    pickup_time,
    dropoff_location,
    dropoff_date,
    dropoff_time,
    cost,
    currency,
    includes,
    booking_url,
    notes,
    is_confirmed,
  } = body;

  if (!plan_version_id || typeof plan_version_id !== 'string') {
    return NextResponse.json({ error: 'plan_version_id is required' }, { status: 400 });
  }

  if (!type || typeof type !== 'string') {
    return NextResponse.json({ error: 'type is required' }, { status: 400 });
  }

  // Validate type
  const validTypes = ['car_rental', 'flight', 'train', 'bus', 'transfer', 'ferry'];
  if (!validTypes.includes(type)) {
    return NextResponse.json({
      error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
    }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('transport')
    .insert({
      plan_version_id: plan_version_id as string,
      type: type as string,
      provider: provider as string | undefined,
      vehicle: vehicle as string | undefined,
      reference_number: reference_number as string | undefined,
      pickup_location: pickup_location as string | undefined,
      pickup_date: pickup_date as string | undefined,
      pickup_time: pickup_time as string | undefined,
      dropoff_location: dropoff_location as string | undefined,
      dropoff_date: dropoff_date as string | undefined,
      dropoff_time: dropoff_time as string | undefined,
      cost: cost as number | undefined,
      currency: (currency as string) || 'GBP',
      includes: (includes as string[]) || [],
      booking_url: booking_url as string | undefined,
      notes: notes as string | undefined,
      is_confirmed: (is_confirmed as boolean) || false,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] POST /api/transport error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
