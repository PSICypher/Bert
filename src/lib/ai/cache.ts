import { SupabaseClient } from '@supabase/supabase-js';

// Cache expiry durations in hours
export const CACHE_DURATIONS = {
  research: 24,
  comparison: 1,
  optimization: 6,
  plan_change: 24,
  suggestions: 24,
} as const;

export type CacheQueryType = keyof typeof CACHE_DURATIONS;

interface CacheEntry {
  id: string;
  trip_id: string | null;
  query: string;
  query_type: string | null;
  results: unknown;
  model: string | null;
  tokens_used: number | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * Check cache for existing AI result
 */
export async function getCachedResult<T>(
  supabase: SupabaseClient,
  tripId: string | null,
  query: string,
  queryType: CacheQueryType
): Promise<{ result: T; cached: true } | null> {
  const now = new Date().toISOString();

  let queryBuilder = supabase
    .from('ai_research_cache')
    .select('results')
    .eq('query', query.trim())
    .eq('query_type', queryType)
    .gt('expires_at', now);

  // Apply trip_id filter before calling maybeSingle
  if (tripId) {
    queryBuilder = queryBuilder.eq('trip_id', tripId);
  } else {
    queryBuilder = queryBuilder.is('trip_id', null);
  }

  const { data: cached, error } = await queryBuilder.maybeSingle();

  if (error || !cached) {
    return null;
  }

  return { result: cached.results as T, cached: true };
}

/**
 * Store AI result in cache
 */
export async function setCachedResult(
  supabase: SupabaseClient,
  tripId: string | null,
  query: string,
  queryType: CacheQueryType,
  results: unknown,
  model?: string,
  tokensUsed?: number
): Promise<void> {
  const durationHours = CACHE_DURATIONS[queryType];
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + durationHours);

  await supabase.from('ai_research_cache').insert({
    trip_id: tripId,
    query: query.trim(),
    query_type: queryType,
    results,
    model,
    tokens_used: tokensUsed,
    expires_at: expiresAt.toISOString(),
  });
}

/**
 * Generate a cache key for complex queries
 */
export function generateCacheKey(params: Record<string, unknown>): string {
  const sortedKeys = Object.keys(params).sort();
  const parts = sortedKeys.map(key => {
    const value = params[key];
    if (value === undefined || value === null) return null;
    if (typeof value === 'object') {
      return `${key}:${JSON.stringify(value)}`;
    }
    return `${key}:${value}`;
  }).filter(Boolean);
  return parts.join('|');
}

/**
 * Clean up expired cache entries (run periodically)
 */
export async function cleanupExpiredCache(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('ai_research_cache')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    console.error('Cache cleanup error:', error);
    return 0;
  }

  return data?.length || 0;
}
