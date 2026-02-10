import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/trips/[id]/public-token
 * Generate or retrieve a public share token (owner only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id: tripId } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user owns the trip
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('user_id, public_share_token')
    .eq('id', tripId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Only trip owner can generate public token' }, { status: 403 });
  }

  // Return existing token if present
  if (trip.public_share_token) {
    return NextResponse.json({ token: trip.public_share_token });
  }

  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');

  const { error: updateError } = await supabase
    .from('trips')
    .update({ public_share_token: token })
    .eq('id', tripId);

  if (updateError) {
    console.error('[API] POST /api/trips/[id]/public-token error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ token });
}

/**
 * DELETE /api/trips/[id]/public-token
 * Revoke public share token (owner only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id: tripId } = await params;

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
    return NextResponse.json({ error: 'Only trip owner can revoke public token' }, { status: 403 });
  }

  const { error: updateError } = await supabase
    .from('trips')
    .update({ public_share_token: null })
    .eq('id', tripId);

  if (updateError) {
    console.error('[API] DELETE /api/trips/[id]/public-token error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
