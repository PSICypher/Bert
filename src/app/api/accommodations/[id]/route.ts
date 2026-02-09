import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/accommodations/[id]
 * Get a single accommodation
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
    .from('accommodations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Accommodation not found' }, { status: 404 });
    }
    console.error('[API] GET /api/accommodations/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/accommodations/[id]
 * Update an accommodation
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
    'name',
    'type',
    'location',
    'address',
    'coordinates',
    'check_in',
    'check_out',
    'cost',
    'currency',
    'booking_reference',
    'booking_url',
    'cancellation_policy',
    'amenities',
    'notes',
    'color',
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

  const { data, error } = await supabase
    .from('accommodations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Accommodation not found or not authorized' }, { status: 404 });
    }
    console.error('[API] PATCH /api/accommodations/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/accommodations/[id]
 * Delete an accommodation
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
    .from('accommodations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[API] DELETE /api/accommodations/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
