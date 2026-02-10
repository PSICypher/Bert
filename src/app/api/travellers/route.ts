import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/database.types'

type TravellerInsert = Database['public']['Tables']['travellers']['Insert']
type TravellerUpdate = Database['public']['Tables']['travellers']['Update']

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tripId = searchParams.get('trip_id')

  if (!tripId) {
    return NextResponse.json({ error: 'trip_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('travellers')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })

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

  const body: TravellerInsert = await request.json()

  if (!body.trip_id || !body.name) {
    return NextResponse.json(
      { error: 'trip_id and name are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('travellers')
    .insert(body as any)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
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

  const { id, ...updates } = body as { id: string } & TravellerUpdate

  const { data, error } = await (supabase
    .from('travellers') as any)
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

  const { error } = await supabase.from('travellers').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
