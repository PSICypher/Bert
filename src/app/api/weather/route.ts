import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'

// In-memory cache with 1 hour TTL
const cache = new Map<string, { data: WeatherForecast[]; expires: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in ms

interface WeatherForecast {
  date: string
  tempMax: number
  tempMin: number
  precipChance: number
  weatherCode: number
}

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  if (!lat || !lng) {
    return NextResponse.json(
      { error: 'lat and lng are required' },
      { status: 400 }
    )
  }

  const cacheKey = `${lat},${lng}`

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json({ forecast: cached.data, cached: true })
  }

  try {
    // Fetch from Open-Meteo API (free, no key required)
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=auto&forecast_days=14`,
      { next: { revalidate: 3600 } }
    )

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`)
    }

    const data = await response.json()

    // Transform to our format
    const forecast: WeatherForecast[] = data.daily.time.map((date: string, i: number) => ({
      date,
      tempMax: Math.round(data.daily.temperature_2m_max[i]),
      tempMin: Math.round(data.daily.temperature_2m_min[i]),
      precipChance: data.daily.precipitation_probability_max[i] || 0,
      weatherCode: data.daily.weather_code[i]
    }))

    // Cache the result
    cache.set(cacheKey, {
      data: forecast,
      expires: Date.now() + CACHE_TTL
    })

    return NextResponse.json({ forecast, cached: false })
  } catch (error) {
    console.error('Weather API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}
