import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string; shareId: string }>;
}

/**
 * PATCH /api/trips/[id]/shares/[shareId]
 * Update share permission (owner only)
 * Body: { permission: 'view' | 'edit' | 'admin' }
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id: tripId, shareId } = await params;

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

  const { permission } = body;

  // Validate permission
  const validPermissions = ['view', 'edit', 'admin'];
  if (!permission || typeof permission !== 'string' || !validPermissions.includes(permission)) {
    return NextResponse.json({ error: 'Invalid permission. Must be: view, edit, or admin' }, { status: 400 });
  }

  // Verify user owns the trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Only trip owner can update shares' }, { status: 403 });
  }

  // Update share
  const { data, error } = await supabase
    .from('trip_shares')
    .update({ permission })
    .eq('id', shareId)
    .eq('trip_id', tripId)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 });
    }
    console.error('[API] PATCH /api/trips/[id]/shares/[shareId] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/trips/[id]/shares/[shareId]
 * Remove a share (owner only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id: tripId, shareId } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user owns the trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Only trip owner can remove shares' }, { status: 403 });
  }

  // Delete share
  const { error } = await supabase
    .from('trip_shares')
    .delete()
    .eq('id', shareId)
    .eq('trip_id', tripId);

  if (error) {
    console.error('[API] DELETE /api/trips/[id]/shares/[shareId] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
