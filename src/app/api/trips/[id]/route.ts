import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/trips/[id]
 * Get a single trip with metadata (plan versions count, pending decisions count)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*')
    .eq('id', id)
    .single();

  if (tripError) {
    if (tripError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }
    console.error('[API] GET /api/trips/[id] error:', tripError);
    return NextResponse.json({ error: tripError.message }, { status: 500 });
  }

  // Get plan versions count
  const { count: planVersionsCount } = await supabase
    .from('plan_versions')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', id);

  // Get pending decisions count
  const { count: pendingDecisionsCount } = await supabase
    .from('decisions')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', id)
    .eq('status', 'pending');

  return NextResponse.json({
    ...trip,
    plan_versions_count: planVersionsCount || 0,
    pending_decisions_count: pendingDecisionsCount || 0,
  });
}

/**
 * PATCH /api/trips/[id]
 * Update a trip (owner only)
 * Allowed fields: name, description, destination, start_date, end_date, cover_image_url, is_archived
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

  // Only allow updating specific fields
  const allowedFields = ['name', 'description', 'destination', 'start_date', 'end_date', 'cover_image_url', 'is_archived'];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Update trip (RLS ensures only owner can update)
  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Trip not found or not authorized' }, { status: 404 });
    }
    console.error('[API] PATCH /api/trips/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/trips/[id]
 * Delete a trip (owner only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Delete trip (RLS ensures only owner can delete, CASCADE handles children)
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[API] DELETE /api/trips/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
