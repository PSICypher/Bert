import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient();
    const planId = params.id;

    const { data, error } = await supabase
      .from('plan_versions')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient();
    const planId = params.id;
    const body = await request.json();

    // If setting as active, unset other plans first
    if (body.is_active === true) {
      // Get the trip_id for this plan
      const { data: plan } = await supabase
        .from('plan_versions')
        .select('trip_id')
        .eq('id', planId)
        .single();

      if (plan) {
        await supabase
          .from('plan_versions')
          .update({ is_active: false })
          .eq('trip_id', plan.trip_id);
      }
    }

    const { data, error } = await supabase
      .from('plan_versions')
      .update(body)
      .eq('id', planId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient();
    const planId = params.id;

    // Check if this is the last plan for the trip
    const { data: plan } = await supabase
      .from('plan_versions')
      .select('trip_id')
      .eq('id', planId)
      .single();

    if (plan) {
      const { count } = await supabase
        .from('plan_versions')
        .select('*', { count: 'exact', head: true })
        .eq('trip_id', plan.trip_id);

      if (count && count <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last plan' },
          { status: 400 }
        );
      }
    }

    const { error } = await supabase
      .from('plan_versions')
      .delete()
      .eq('id', planId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete plan' },
      { status: 500 }
    );
  }
}
