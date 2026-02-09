import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

/**
 * GET /api/accommodations
 * List accommodations for a plan version
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
    .from('accommodations')
    .select('*')
    .eq('plan_version_id', planVersionId)
    .order('check_in', { ascending: true });

  if (error) {
    console.error('[API] GET /api/accommodations error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/accommodations
 * Create an accommodation
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
    name,
    type,
    location,
    address,
    coordinates,
    check_in,
    check_out,
    cost,
    currency,
    booking_reference,
    booking_url,
    cancellation_policy,
    amenities,
    notes,
    color,
    is_confirmed,
  } = body;

  if (!plan_version_id || typeof plan_version_id !== 'string') {
    return NextResponse.json({ error: 'plan_version_id is required' }, { status: 400 });
  }

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!check_in || !check_out) {
    return NextResponse.json({ error: 'check_in and check_out are required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('accommodations')
    .insert({
      plan_version_id: plan_version_id as string,
      name: name as string,
      type: (type as string) || 'hotel',
      location: location as string | undefined,
      address: address as string | undefined,
      coordinates: coordinates as { lat: number; lng: number } | undefined,
      check_in: check_in as string,
      check_out: check_out as string,
      cost: cost as number | undefined,
      currency: (currency as string) || 'GBP',
      booking_reference: booking_reference as string | undefined,
      booking_url: booking_url as string | undefined,
      cancellation_policy: cancellation_policy as string | undefined,
      amenities: (amenities as string[]) || [],
      notes: notes as string | undefined,
      color: (color as string) || '#4ECDC4',
      is_confirmed: (is_confirmed as boolean) || false,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] POST /api/accommodations error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
