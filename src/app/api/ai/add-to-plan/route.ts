import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

interface SuggestionData {
  name: string;
  cost?: number;
  currency?: string;
  location?: string;
  description?: string;
  pros?: string[];
  cons?: string[];
  applyData?: Record<string, unknown>;
  // Activity specific
  time_start?: string;
  time_end?: string;
  itinerary_day_id?: string;
  // Accommodation specific
  type?: string;
  check_in?: string;
  check_out?: string;
  amenities?: string[];
  // Decision specific
  options?: Array<{ name: string; description?: string }>;
  due_date?: string;
  priority?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      plan_version_id,
      trip_id,
      suggestion_type,
      data,
    } = body as {
      plan_version_id: string;
      trip_id: string;
      suggestion_type: string;
      data: SuggestionData;
    };

    if (!plan_version_id || !trip_id || !suggestion_type || !data) {
      return NextResponse.json(
        { error: 'plan_version_id, trip_id, suggestion_type, and data are required' },
        { status: 400 }
      );
    }

    // Handle different suggestion types
    switch (suggestion_type) {
      case 'accommodation': {
        const { data: accommodation, error } = await supabase
          .from('accommodations')
          .insert({
            plan_version_id,
            name: data.name,
            type: data.type || 'hotel',
            location: data.location,
            cost: data.cost,
            currency: data.currency || 'GBP',
            check_in: data.check_in || data.applyData?.check_in,
            check_out: data.check_out || data.applyData?.check_out,
            amenities: data.amenities || [],
            notes: data.description
              ? `${data.description}${data.pros?.length ? '\n\nPros: ' + data.pros.join(', ') : ''}${data.cons?.length ? '\nCons: ' + data.cons.join(', ') : ''}`
              : null,
            ...(data.applyData || {}),
          })
          .select()
          .single();

        if (error) {
          console.error('Add accommodation error:', error);
          return NextResponse.json(
            { error: 'Failed to add accommodation' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          type: 'accommodation',
          item: accommodation,
        });
      }

      case 'activity': {
        if (!data.itinerary_day_id) {
          return NextResponse.json(
            { error: 'itinerary_day_id is required for activities' },
            { status: 400 }
          );
        }

        const { data: activity, error } = await supabase
          .from('activities')
          .insert({
            plan_version_id,
            itinerary_day_id: data.itinerary_day_id,
            name: data.name,
            location: data.location,
            cost: data.cost,
            currency: data.currency || 'GBP',
            time_start: data.time_start,
            time_end: data.time_end,
            notes: data.description,
            ...(data.applyData || {}),
          })
          .select()
          .single();

        if (error) {
          console.error('Add activity error:', error);
          return NextResponse.json(
            { error: 'Failed to add activity' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          type: 'activity',
          item: activity,
        });
      }

      case 'cost': {
        const { data: cost, error } = await supabase
          .from('costs')
          .insert({
            plan_version_id,
            category: data.applyData?.category || 'misc',
            item: data.name,
            amount: data.cost || 0,
            currency: data.currency || 'GBP',
            is_estimated: true,
            notes: data.description,
          })
          .select()
          .single();

        if (error) {
          console.error('Add cost error:', error);
          return NextResponse.json(
            { error: 'Failed to add cost' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          type: 'cost',
          item: cost,
        });
      }

      case 'decision': {
        const { data: decision, error } = await supabase
          .from('decisions')
          .insert({
            trip_id,
            plan_version_id,
            title: data.name,
            description: data.description,
            options: data.options || (data.pros && data.cons
              ? [
                  { name: 'Option A', pros: data.pros, cons: data.cons },
                ]
              : []),
            due_date: data.due_date,
            priority: data.priority || 'medium',
            status: 'pending',
          })
          .select()
          .single();

        if (error) {
          console.error('Add decision error:', error);
          return NextResponse.json(
            { error: 'Failed to add decision' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          type: 'decision',
          item: decision,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown suggestion_type: ${suggestion_type}. Must be one of: accommodation, activity, cost, decision` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('AI add-to-plan error:', error);
    return NextResponse.json(
      { error: 'Failed to add suggestion to plan' },
      { status: 500 }
    );
  }
}
