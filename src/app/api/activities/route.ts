import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/database.types'

type ActivityInsert = Database['public']['Tables']['activities']['Insert']
type ActivityUpdate = Database['public']['Tables']['activities']['Update']

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const planVersionId = searchParams.get('plan_version_id')
  const itineraryDayId = searchParams.get('itinerary_day_id')

  if (!planVersionId && !itineraryDayId) {
    return NextResponse.json(
      { error: 'plan_version_id or itinerary_day_id is required' },
      { status: 400 }
    )
  }

  let query = supabase.from('activities').select('*')

  if (planVersionId) {
    query = query.eq('plan_version_id', planVersionId)
  }
  if (itineraryDayId) {
    query = query.eq('itinerary_day_id', itineraryDayId)
  }

  const { data, error } = await query.order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Support bulk creation if array is provided
  const activities: ActivityInsert[] = Array.isArray(body) ? body : [body]

  // Validate required fields
  for (const activity of activities) {
    if (!activity.plan_version_id || !activity.itinerary_day_id || !activity.name) {
      return NextResponse.json(
        { error: 'plan_version_id, itinerary_day_id, and name are required' },
        { status: 400 }
      )
    }
  }

  const { data, error } = await supabase
    .from('activities')
    .insert(activities as any)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(Array.isArray(body) ? data : data![0], { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { id, ...updates } = body as { id: string } & ActivityUpdate

  const { data, error } = await (supabase
    .from('activities') as any)
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { error } = await supabase.from('activities').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
