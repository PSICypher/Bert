import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { searchParams } = new URL(request.url);
    const planVersionId = searchParams.get('planVersionId');

    if (!planVersionId) {
      return NextResponse.json(
        { error: 'planVersionId is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('plan_version_id', planVersionId)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching checklist:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const body = await request.json();

    // Get the next sort order
    const { data: existing } = await supabase
      .from('checklist_items')
      .select('sort_order')
      .eq('plan_version_id', body.plan_version_id)
      .order('sort_order', { ascending: false })
      .limit(1);

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

    const { data, error } = await supabase
      .from('checklist_items')
      .insert({ ...body, sort_order: body.sort_order ?? nextOrder })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating checklist item:', error);
    return NextResponse.json(
      { error: 'Failed to create checklist item' },
      { status: 500 }
    );
  }
}
