import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/plan-versions/[id]
 * Get a single plan version
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
    .from('plan_versions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });
    }
    console.error('[API] GET /api/plan-versions/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/plan-versions/[id]
 * Update a plan version
 * Allowed fields: name, description, is_active, currency, color
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
  const allowedFields = ['name', 'description', 'is_active', 'currency', 'color'];
  const updates: Record<string, unknown> = {};

  for (const field of allowedFields) {
    if (field in body) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // If setting as active, deactivate other plans first
  if (updates.is_active === true) {
    // Get the trip_id first
    const { data: planVersion } = await supabase
      .from('plan_versions')
      .select('trip_id')
      .eq('id', id)
      .single();

    if (planVersion) {
      await supabase
        .from('plan_versions')
        .update({ is_active: false })
        .eq('trip_id', planVersion.trip_id)
        .neq('id', id);
    }
  }

  const { data, error } = await supabase
    .from('plan_versions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Plan version not found or not authorized' }, { status: 404 });
    }
    console.error('[API] PATCH /api/plan-versions/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * DELETE /api/plan-versions/[id]
 * Delete a plan version
 * Note: Cannot delete the last remaining plan version
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the plan version to find the trip_id
  const { data: planVersion, error: fetchError } = await supabase
    .from('plan_versions')
    .select('trip_id')
    .eq('id', id)
    .single();

  if (fetchError || !planVersion) {
    return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });
  }

  // Check if this is the last plan version
  const { count } = await supabase
    .from('plan_versions')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', planVersion.trip_id);

  if (count !== null && count <= 1) {
    return NextResponse.json({ error: 'Cannot delete the last plan version' }, { status: 400 });
  }

  // Delete the plan version (CASCADE will handle children)
  const { error } = await supabase
    .from('plan_versions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[API] DELETE /api/plan-versions/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
