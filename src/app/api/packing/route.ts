import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { searchParams } = new URL(request.url);
    const tripId = searchParams.get('tripId');
    const countOnly = searchParams.get('countOnly') === 'true';

    if (!tripId) {
      return NextResponse.json(
        { error: 'tripId is required' },
        { status: 400 }
      );
    }

    if (countOnly) {
      // Return just the counts
      const { data, error } = await supabase
        .from('packing_items')
        .select('packed')
        .eq('trip_id', tripId);

      if (error) throw error;

      const total = data?.length || 0;
      const packed = data?.filter((item) => item.packed).length || 0;

      return NextResponse.json({ total, packed });
    }

    // Return full list
    const { data, error } = await supabase
      .from('packing_items')
      .select('*')
      .eq('trip_id', tripId)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching packing items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch packing items' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const body = await request.json();

    // Get the next sort order for the category
    const { data: existing } = await supabase
      .from('packing_items')
      .select('sort_order')
      .eq('trip_id', body.trip_id)
      .eq('category', body.category || 'other')
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('packing_items')
      .insert({ ...body, sort_order: body.sort_order ?? nextOrder })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating packing item:', error);
    return NextResponse.json(
      { error: 'Failed to create packing item' },
      { status: 500 }
    );
  }
}
