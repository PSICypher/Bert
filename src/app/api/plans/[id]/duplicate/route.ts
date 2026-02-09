import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient();
    const planId = params.id;

    // Get the original plan
    const { data: originalPlan, error: planError } = await supabase
      .from('plan_versions')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !originalPlan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    // Create a new plan with copied data
    const { data: newPlan, error: createError } = await supabase
      .from('plan_versions')
      .insert({
        trip_id: originalPlan.trip_id,
        name: `${originalPlan.name} (Copy)`,
        description: originalPlan.description,
        is_active: false,
        total_cost: originalPlan.total_cost,
        currency: originalPlan.currency,
        color: originalPlan.color,
      })
      .select()
      .single();

    if (createError || !newPlan) {
      throw createError || new Error('Failed to create plan');
    }

    // Copy itinerary days
    const { data: days } = await supabase
      .from('itinerary_days')
      .select('*')
      .eq('plan_version_id', planId);

    if (days && days.length > 0) {
      const newDays = days.map((day) => ({
        ...day,
        id: undefined,
        plan_version_id: newPlan.id,
        created_at: undefined,
        updated_at: undefined,
      }));
      await supabase.from('itinerary_days').insert(newDays);
    }

    // Copy accommodations
    const { data: accommodations } = await supabase
      .from('accommodations')
      .select('*')
      .eq('plan_version_id', planId);

    if (accommodations && accommodations.length > 0) {
      const newAccommodations = accommodations.map((acc) => ({
        ...acc,
        id: undefined,
        plan_version_id: newPlan.id,
        created_at: undefined,
        updated_at: undefined,
      }));
      await supabase.from('accommodations').insert(newAccommodations);
    }

    // Copy transport
    const { data: transport } = await supabase
      .from('transport')
      .select('*')
      .eq('plan_version_id', planId);

    if (transport && transport.length > 0) {
      const newTransport = transport.map((t) => ({
        ...t,
        id: undefined,
        plan_version_id: newPlan.id,
        created_at: undefined,
        updated_at: undefined,
      }));
      await supabase.from('transport').insert(newTransport);
    }

    // Copy costs
    const { data: costs } = await supabase
      .from('costs')
      .select('*')
      .eq('plan_version_id', planId);

    if (costs && costs.length > 0) {
      const newCosts = costs.map((cost) => ({
        ...cost,
        id: undefined,
        plan_version_id: newPlan.id,
        itinerary_day_id: null, // Reset day links for now
        created_at: undefined,
      }));
      await supabase.from('costs').insert(newCosts);
    }

    return NextResponse.json(newPlan, { status: 201 });
  } catch (error) {
    console.error('Error duplicating plan:', error);
    return NextResponse.json(
      { error: 'Failed to duplicate plan' },
      { status: 500 }
    );
  }
}
