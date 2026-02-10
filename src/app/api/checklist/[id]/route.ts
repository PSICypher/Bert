import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/checklist/[id]
 * Get a single checklist item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createRouteHandlerClient();
    const { id } = await params;

    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching checklist item:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist item' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/checklist/[id]
 * Update a checklist item
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createRouteHandlerClient();
    const { id } = await params;
    const body = await request.json();

    // Allowed fields for update
    const allowedFields = [
      'name',
      'category',
      'description',
      'booking_status',
      'booking_reference',
      'booking_url',
      'total_cost',
      'deposit_amount',
      'amount_paid',
      'is_fully_paid',
      'payment_type',
      'payment_due_date',
      'payment_due_context',
      'notes',
      'sort_order',
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
      .from('checklist_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return NextResponse.json(
      { error: 'Failed to update checklist item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checklist/[id]
 * Delete a checklist item
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createRouteHandlerClient();
    const { id } = await params;

    const { error } = await supabase
      .from('checklist_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting checklist item:', error);
    return NextResponse.json(
      { error: 'Failed to delete checklist item' },
      { status: 500 }
    );
  }
}
