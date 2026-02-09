import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

// In-memory cache with 24 hour TTL
const cache = new Map<string, { data: ExchangeRateResponse; expires: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours in ms

interface ExchangeRateResponse {
  from: string
  to: string
  rate: number
  date: string
}

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') || 'GBP'
  const to = searchParams.get('to') || 'USD'

  const cacheKey = `${from.toUpperCase()}-${to.toUpperCase()}`

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ ...cached.data, cached: true })
  }

  try {
    // Fetch from Frankfurter.app API (free, no key required)
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=${from.toUpperCase()}&to=${to.toUpperCase()}`,
      { next: { revalidate: 86400 } }
    )

    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`)
    }

    const data = await response.json()

    const result: ExchangeRateResponse = {
      from: from.toUpperCase(),
      to: to.toUpperCase(),
      rate: data.rates[to.toUpperCase()],
      date: data.date
    }

    // Cache the result
    cache.set(cacheKey, {
      data: result,
      expires: Date.now() + CACHE_TTL
    })

    return NextResponse.json({ ...result, cached: false })
  } catch (error) {
    console.error('Exchange rate API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate' },
      { status: 500 }
    )
  }
}
