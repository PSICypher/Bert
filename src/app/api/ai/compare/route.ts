import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { comparePlans } from '@/lib/ai/anthropic';
import { getCachedResult, setCachedResult, generateCacheKey } from '@/lib/ai/cache';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trip_id } = body;

    if (!trip_id) {
      return NextResponse.json(
        { error: 'trip_id is required' },
        { status: 400 }
      );
    }

    // Fetch plan versions for the trip
    const { data: planVersions, error: plansError } = await supabase
      .from('plan_versions')
      .select(`
        id,
        name,
        description,
        total_cost,
        currency,
        accommodations (
          id,
          name,
          type,
          location,
          cost,
          check_in,
          check_out
        ),
        transport (
          id,
          type,
          provider,
          cost
        ),
        costs (
          id,
          category,
          item,
          amount
        )
      `)
      .eq('trip_id', trip_id);

    if (plansError) {
      return NextResponse.json(
        { error: 'Failed to fetch plan versions' },
        { status: 500 }
      );
    }

    if (!planVersions || planVersions.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 plan versions required for comparison' },
        { status: 400 }
      );
    }

    // Generate cache key based on plan IDs
    const planIds = planVersions.map(p => p.id).sort().join(',');
    const cacheKey = generateCacheKey({ trip_id, plan_ids: planIds });

    // Check cache
    const cached = await getCachedResult<string>(
      supabase,
      trip_id,
      cacheKey,
      'comparison'
    );

    if (cached) {
      return NextResponse.json(cached);
    }

    // Format plans data for comparison
    const plansData = planVersions.map(plan => {
      const accomCost = plan.accommodations?.reduce((sum: number, a: { cost?: number }) => sum + (a.cost || 0), 0) || 0;
      const transportCost = plan.transport?.reduce((sum: number, t: { cost?: number }) => sum + (t.cost || 0), 0) || 0;

      return `
## ${plan.name}
${plan.description || ''}

Total Cost: ${plan.currency} ${plan.total_cost}

Accommodations (${plan.currency} ${accomCost}):
${plan.accommodations?.map((a: { name: string; type: string; location?: string; cost?: number }) => `- ${a.name} (${a.type}) in ${a.location}: ${plan.currency} ${a.cost}`).join('\n') || 'None'}

Transport (${plan.currency} ${transportCost}):
${plan.transport?.map((t: { type: string; provider?: string; cost?: number }) => `- ${t.type} via ${t.provider}: ${plan.currency} ${t.cost}`).join('\n') || 'None'}

Cost Breakdown:
${plan.costs?.map((c: { category: string; item: string; amount: number }) => `- ${c.category}: ${c.item} - ${plan.currency} ${c.amount}`).join('\n') || 'None'}
`;
    }).join('\n---\n');

    // Get comparison from AI
    const result = await comparePlans(plansData);

    // Cache result
    await setCachedResult(
      supabase,
      trip_id,
      cacheKey,
      'comparison',
      result
    );

    return NextResponse.json({ result, cached: false });
  } catch (error) {
    console.error('AI compare error:', error);
    return NextResponse.json(
      { error: 'Plan comparison failed' },
      { status: 500 }
    );
  }
}
