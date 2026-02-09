import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

// Allowlist for sharing (must match middleware and login page)
const ALLOWED_EMAILS = [
  'schalk.vdmerwe@gmail.com',
  'vdmkelz@gmail.com',
];

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/trips/[id]/shares
 * List all shares for a trip (owner only)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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
    return NextResponse.json({ error: 'Only trip owner can view shares' }, { status: 403 });
  }

  // Get shares
  const { data, error } = await supabase
    .from('trip_shares')
    .select('*')
    .eq('trip_id', tripId)
    .order('invited_at', { ascending: false });

  if (error) {
    console.error('[API] GET /api/trips/[id]/shares error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/trips/[id]/shares
 * Share a trip with another user (owner only)
 * Body: { email, permission: 'view' | 'edit' | 'admin' }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id: tripId } = await params;

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

  const { email, permission } = body;

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Validate permission
  const validPermissions = ['view', 'edit', 'admin'];
  const perm = permission && typeof permission === 'string' ? permission : 'view';
  if (!validPermissions.includes(perm)) {
    return NextResponse.json({ error: 'Invalid permission. Must be: view, edit, or admin' }, { status: 400 });
  }

  // Check allowlist
  if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
    return NextResponse.json({ error: 'Can only share with approved users' }, { status: 403 });
  }

  // Cannot share with yourself
  if (normalizedEmail === user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'Cannot share with yourself' }, { status: 400 });
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
    return NextResponse.json({ error: 'Only trip owner can share' }, { status: 403 });
  }

  // Check for existing share
  const { data: existingShare } = await supabase
    .from('trip_shares')
    .select('id')
    .eq('trip_id', tripId)
    .eq('shared_with_email', normalizedEmail)
    .single();

  if (existingShare) {
    return NextResponse.json({ error: 'Trip already shared with this email' }, { status: 409 });
  }

  // Create share
  const { data, error } = await supabase
    .from('trip_shares')
    .insert({
      trip_id: tripId,
      shared_with_email: normalizedEmail,
      permission: perm,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] POST /api/trips/[id]/shares error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
