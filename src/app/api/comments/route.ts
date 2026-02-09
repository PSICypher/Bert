import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/database.types'

type CommentInsert = Database['public']['Tables']['comments']['Insert']

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const tripId = searchParams.get('trip_id')
  const itemType = searchParams.get('item_type')
  const itemId = searchParams.get('item_id')

  if (!tripId || !itemType || !itemId) {
    return NextResponse.json(
      { error: 'trip_id, item_type, and item_id are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('trip_id', tripId)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
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

  const body = await request.json()

  if (!body.trip_id || !body.item_type || !body.item_id || !body.message) {
    return NextResponse.json(
      { error: 'trip_id, item_type, item_id, and message are required' },
      { status: 400 }
    )
  }

  const commentData: CommentInsert = {
    trip_id: body.trip_id,
    item_type: body.item_type,
    item_id: body.item_id,
    message: body.message,
    user_id: user.id
  }

  const { data, error } = await supabase
    .from('comments')
    .insert(commentData as any)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
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

  // Only allow deletion of own comments
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
