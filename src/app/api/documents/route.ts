import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase-server'
import type { Database } from '@/lib/database.types'

type DocumentInsert = Database['public']['Tables']['documents']['Insert']

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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
    .from('documents')
    .select('*')
    .eq('trip_id', tripId)
    .order('uploaded_at', { ascending: false })

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

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const tripId = formData.get('trip_id') as string | null
  const linkedItemType = formData.get('linked_item_type') as string | null
  const linkedItemId = formData.get('linked_item_id') as string | null
  const notes = formData.get('notes') as string | null

  if (!file || !tripId) {
    return NextResponse.json(
      { error: 'file and trip_id are required' },
      { status: 400 }
    )
  }

  // Validate file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: 'File type not allowed. Supported: PDF, JPG, PNG, WEBP, DOC, DOCX' },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File size exceeds 10MB limit' },
      { status: 400 }
    )
  }

  // Generate unique filename
  const timestamp = Date.now()
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `${tripId}/${timestamp}-${sanitizedName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('trip-documents')
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('trip-documents')
    .getPublicUrl(filePath)

  // Insert document record
  const documentData: DocumentInsert = {
    trip_id: tripId,
    file_name: file.name,
    file_url: urlData.publicUrl,
    file_type: file.type,
    uploaded_by: user.id,
    linked_item_type: linkedItemType,
    linked_item_id: linkedItemId,
    notes
  }

  const { data, error } = await supabase
    .from('documents')
    .insert(documentData as any)
    .select()
    .single()

  if (error) {
    // Clean up uploaded file if database insert fails
    await supabase.storage.from('trip-documents').remove([filePath])
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

  // Get document to find the file path
  const { data: doc, error: fetchError } = await (supabase
    .from('documents') as any)
    .select('file_url, trip_id')
    .eq('id', id)
    .single() as { data: { file_url: string; trip_id: string } | null; error: any }

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  // Extract file path from URL and delete from storage
  if (doc?.file_url) {
    const urlParts = doc.file_url.split('/trip-documents/')
    if (urlParts.length > 1) {
      const filePath = urlParts[1]
      await supabase.storage.from('trip-documents').remove([filePath])
    }
  }

  // Delete document record
  const { error } = await supabase.from('documents').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
