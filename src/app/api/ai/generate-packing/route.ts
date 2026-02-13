import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase-server';
import { generatePackingList } from '@/lib/ai/anthropic';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      destination,
      startDate,
      endDate,
      travellerCount,
      activities = [],
      trip_id,
      save_to_trip = false,
      itinerary,
    } = body;

    if (!destination || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'destination, startDate, and endDate are required' },
        { status: 400 }
      );
    }

    // Generate packing list using AI with full itinerary context
    const packingItems = await generatePackingList(
      destination,
      startDate,
      endDate,
      travellerCount || 2,
      activities,
      itinerary
    );

    // Optionally save to trip
    if (save_to_trip && trip_id && packingItems.length > 0) {
      const itemsToInsert = packingItems.map((item, index) => ({
        trip_id,
        category: item.category,
        name: item.name,
        quantity: item.quantity,
        packed: false,
        sort_order: index,
      }));

      const { error: insertError } = await supabase
        .from('packing_items')
        .insert(itemsToInsert);

      if (insertError) {
        console.error('Failed to save packing items:', insertError);
        // Return items anyway, just note the save failed
        return NextResponse.json({
          items: packingItems,
          saved: false,
          save_error: 'Failed to save items to trip',
        });
      }

      return NextResponse.json({
        items: packingItems,
        saved: true,
        items_count: packingItems.length,
      });
    }

    return NextResponse.json({
      items: packingItems,
      saved: false,
    });
  } catch (error) {
    console.error('AI generate-packing error:', error);
    return NextResponse.json(
      { error: 'Packing list generation failed' },
      { status: 500 }
    );
  }
}
