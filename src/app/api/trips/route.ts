import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

/**
 * GET /api/trips
 * List all trips for the authenticated user (owned or shared)
 * Query params: archived (optional) - filter by archive status
 */
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const archivedParam = searchParams.get('archived');

  let query = supabase
    .from('trips')
    .select('*')
    .order('updated_at', { ascending: false });

  // Filter by archived status if provided
  if (archivedParam !== null) {
    query = query.eq('is_archived', archivedParam === 'true');
  }

  const { data, error } = await query;

  if (error) {
    console.error('[API] GET /api/trips error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * POST /api/trips
 * Create a new trip
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

  const { name, description, destination, start_date, end_date, cover_image_url } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('trips')
    .insert({
      user_id: user.id,
      name: name as string,
      description: description as string | undefined,
      destination: destination as string | undefined,
      start_date: start_date as string | undefined,
      end_date: end_date as string | undefined,
      cover_image_url: cover_image_url as string | undefined,
    })
    .select()
    .single();

  if (error) {
    console.error('[API] POST /api/trips error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
