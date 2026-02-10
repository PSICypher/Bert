import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/transport/[id]
 * Get a single transport item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('transport')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Transport not found' }, { status: 404 });
    }
    console.error('[API] GET /api/transport/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/transport/[id]
 * Update a transport item
 * All fields except id and plan_version_id can be updated
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id } = await params;

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

  // Allowed fields for update (all except id and plan_version_id)
  const allowedFields = [
    'type',
    'provider',
    'vehicle',
    'reference_number',
    'pickup_location',
    'pickup_date',
    'pickup_time',
    'dropoff_location',
    'dropoff_date',
    'dropoff_time',
    'cost',
    'currency',
    'includes',
    'booking_url',
    'notes',
    'is_confirmed',
  ];

  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Validate type if being updated
  if (updates.type) {
    const validTypes = ['car_rental', 'flight', 'train', 'bus', 'transfer', 'ferry'];
    if (!validTypes.includes(updates.type as string)) {
      return NextResponse.json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }
  }

  const { data, error } = await supabase
    .from('transport')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Transport not found or not authorized' }, { status: 404 });
    }
    console.error('[API] PATCH /api/transport/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/transport/[id]
 * Delete a transport item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('transport')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[API] DELETE /api/transport/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
