import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/plan-versions/[id]/clone
 * Clone a plan version with all its data
 * Body: { name?: string } - Optional name, defaults to "[Original Name] (Copy)"
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = createRouteHandlerClient();
  const { id } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const customName = body.name as string | undefined;

  // Get the source plan version
  const { data: sourcePlan, error: sourceError } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('id', id)
    .single();

  if (sourceError || !sourcePlan) {
    return NextResponse.json({ error: 'Plan version not found' }, { status: 404 });
  }

  // Create the cloned plan version
  const { data: clonedPlan, error: cloneError } = await supabase
    .from('plan_versions')
    .insert({
      trip_id: sourcePlan.trip_id,
      name: customName || `${sourcePlan.name} (Copy)`,
      description: sourcePlan.description,
      is_active: false, // Cloned plan is not active by default
      currency: sourcePlan.currency,
      color: sourcePlan.color,
    })
    .select()
    .single();

  if (cloneError || !clonedPlan) {
    console.error('[API] Clone plan version error:', cloneError);
    return NextResponse.json({ error: cloneError?.message || 'Failed to clone plan' }, { status: 500 });
  }

  // Clone itinerary days and build ID mapping
  const dayIdMapping: Record<string, string> = {};

  const { data: sourceDays } = await supabase
    .from('itinerary_days')
    .select('*')
    .eq('plan_version_id', id)
    .order('day_number');

  if (sourceDays && sourceDays.length > 0) {
    for (const day of sourceDays) {
      const { data: clonedDay } = await supabase
        .from('itinerary_days')
        .insert({
          plan_version_id: clonedPlan.id,
          day_number: day.day_number,
          date: day.date,
          location: day.location,
          location_coordinates: day.location_coordinates,
          icon: day.icon,
          color: day.color,
          activities: day.activities,
          notes: day.notes,
          drive_time: day.drive_time,
          drive_distance: day.drive_distance,
        })
        .select()
        .single();

      if (clonedDay) {
        dayIdMapping[day.id] = clonedDay.id;
      }
    }
  }

  // Clone accommodations
  const { data: sourceAccommodations } = await supabase
    .from('accommodations')
    .select('*')
    .eq('plan_version_id', id);

  if (sourceAccommodations && sourceAccommodations.length > 0) {
    const clonedAccommodations = sourceAccommodations.map(acc => ({
      plan_version_id: clonedPlan.id,
      name: acc.name,
      type: acc.type,
      location: acc.location,
      address: acc.address,
      coordinates: acc.coordinates,
      check_in: acc.check_in,
      check_out: acc.check_out,
      cost: acc.cost,
      currency: acc.currency,
      booking_reference: acc.booking_reference,
      booking_url: acc.booking_url,
      cancellation_policy: acc.cancellation_policy,
      amenities: acc.amenities,
      notes: acc.notes,
      color: acc.color,
      is_confirmed: acc.is_confirmed,
    }));

    await supabase.from('accommodations').insert(clonedAccommodations);
  }

  // Clone transport
  const { data: sourceTransport } = await supabase
    .from('transport')
    .select('*')
    .eq('plan_version_id', id);

  if (sourceTransport && sourceTransport.length > 0) {
    const clonedTransport = sourceTransport.map(t => ({
      plan_version_id: clonedPlan.id,
      type: t.type,
      provider: t.provider,
      vehicle: t.vehicle,
      reference_number: t.reference_number,
      pickup_location: t.pickup_location,
      pickup_date: t.pickup_date,
      pickup_time: t.pickup_time,
      dropoff_location: t.dropoff_location,
      dropoff_date: t.dropoff_date,
      dropoff_time: t.dropoff_time,
      cost: t.cost,
      currency: t.currency,
      includes: t.includes,
      booking_url: t.booking_url,
      notes: t.notes,
      is_confirmed: t.is_confirmed,
    }));

    await supabase.from('transport').insert(clonedTransport);
  }

  // Clone costs
  const { data: sourceCosts } = await supabase
    .from('costs')
    .select('*')
    .eq('plan_version_id', id);

  if (sourceCosts && sourceCosts.length > 0) {
    const clonedCosts = sourceCosts.map(c => ({
      plan_version_id: clonedPlan.id,
      itinerary_day_id: c.itinerary_day_id ? dayIdMapping[c.itinerary_day_id] || null : null,
      category: c.category,
      item: c.item,
      amount: c.amount,
      currency: c.currency,
      is_paid: c.is_paid,
      is_estimated: c.is_estimated,
      notes: c.notes,
    }));

    await supabase.from('costs').insert(clonedCosts);
  }

  // Clone activities (linked to cloned days)
  const { data: sourceActivities } = await supabase
    .from('activities')
    .select('*')
    .eq('plan_version_id', id);

  if (sourceActivities && sourceActivities.length > 0) {
    const clonedActivities = sourceActivities
      .filter(a => dayIdMapping[a.itinerary_day_id]) // Only clone if day was cloned
      .map(a => ({
        plan_version_id: clonedPlan.id,
        itinerary_day_id: dayIdMapping[a.itinerary_day_id],
        name: a.name,
        description: a.description,
        time_start: a.time_start,
        time_end: a.time_end,
        location: a.location,
        cost: a.cost,
        currency: a.currency,
        booking_status: a.booking_status,
        booking_reference: a.booking_reference,
        sort_order: a.sort_order,
        notes: a.notes,
      }));

    if (clonedActivities.length > 0) {
      await supabase.from('activities').insert(clonedActivities);
    }
  }

  // Fetch the complete cloned plan with all related data
  const { data: fullClonedPlan } = await supabase
    .from('plan_versions')
    .select('*')
    .eq('id', clonedPlan.id)
    .single();

  return NextResponse.json(fullClonedPlan, { status: 201 });
}
