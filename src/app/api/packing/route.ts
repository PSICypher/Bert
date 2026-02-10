import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/database.types'

type PackingItemInsert = Database['public']['Tables']['packing_items']['Insert']
type PackingItemUpdate = Database['public']['Tables']['packing_items']['Update']

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
    .from('packing_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

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

  // Support bulk creation
  const items: PackingItemInsert[] = Array.isArray(body) ? body : [body]

  for (const item of items) {
    if (!item.trip_id || !item.name) {
      return NextResponse.json(
        { error: 'trip_id and name are required' },
        { status: 400 }
      )
    }
  }

  const { data, error } = await supabase
    .from('packing_items')
    .insert(items as any)
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

  const { id, ...updates } = body as { id: string } & PackingItemUpdate

  const { data, error } = await (supabase
    .from('packing_items') as any)
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

  const { error } = await supabase.from('packing_items').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
