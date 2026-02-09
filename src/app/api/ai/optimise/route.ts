import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { getCostOptimisationTips } from '@/lib/ai/anthropic';
import { getCachedResult, setCachedResult, generateCacheKey } from '@/lib/ai/cache';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { trip_id, plan_version_id } = body;

    if (!trip_id || !plan_version_id) {
      return NextResponse.json(
        { error: 'trip_id and plan_version_id are required' },
        { status: 400 }
      );
    }

    // Fetch plan version with costs
    const { data: planVersion, error: planError } = await supabase
      .from('plan_versions')
      .select(`
        id,
        name,
        total_cost,
        currency,
        costs (
          id,
          category,
          item,
          amount,
          is_estimated,
          notes
        ),
        accommodations (
          id,
          name,
          type,
          location,
          cost,
          check_in,
          check_out,
          nights
        ),
        transport (
          id,
          type,
          provider,
          cost
        )
      `)
      .eq('id', plan_version_id)
      .single();

    if (planError || !planVersion) {
      return NextResponse.json(
        { error: 'Plan version not found' },
        { status: 404 }
      );
    }

    // Generate cache key
    const cacheKey = generateCacheKey({ trip_id, plan_version_id });

    // Check cache
    const cached = await getCachedResult<string>(
      supabase,
      trip_id,
      cacheKey,
      'optimization'
    );

    if (cached) {
      return NextResponse.json(cached);
    }

    // Group costs by category
    const costsByCategory: Record<string, Array<{ item: string; amount: number; is_estimated: boolean }>> = {};
    for (const cost of planVersion.costs || []) {
      if (!costsByCategory[cost.category]) {
        costsByCategory[cost.category] = [];
      }
      costsByCategory[cost.category].push({
        item: cost.item,
        amount: cost.amount,
        is_estimated: cost.is_estimated,
      });
    }

    // Format cost data
    const costData = `
## ${planVersion.name}
Total Cost: ${planVersion.currency} ${planVersion.total_cost}

### Cost Breakdown by Category:
${Object.entries(costsByCategory).map(([category, items]) => {
  const categoryTotal = items.reduce((sum, i) => sum + i.amount, 0);
  return `
**${category}** (${planVersion.currency} ${categoryTotal.toFixed(2)}):
${items.map(i => `- ${i.item}: ${planVersion.currency} ${i.amount}${i.is_estimated ? ' (estimated)' : ''}`).join('\n')}`;
}).join('\n')}

### Accommodations:
${planVersion.accommodations?.map((a: { name: string; type: string; location?: string; cost?: number; nights?: number }) =>
  `- ${a.name} (${a.type}) in ${a.location}: ${planVersion.currency} ${a.cost} for ${a.nights} nights`
).join('\n') || 'None listed'}

### Transport:
${planVersion.transport?.map((t: { type: string; provider?: string; cost?: number }) =>
  `- ${t.type} via ${t.provider}: ${planVersion.currency} ${t.cost}`
).join('\n') || 'None listed'}
`;

    // Get optimization tips from AI
    const result = await getCostOptimisationTips(costData, planVersion.currency);

    // Cache result
    await setCachedResult(
      supabase,
      trip_id,
      cacheKey,
      'optimization',
      result
    );

    return NextResponse.json({ result, cached: false });
  } catch (error) {
    console.error('AI optimise error:', error);
    return NextResponse.json(
      { error: 'Cost optimization failed' },
      { status: 500 }
    );
  }
}
