// ============================================================
// PRAAV — Photo Upload API
// src/app/api/photos/route.ts
// ============================================================
// POST /api/photos  multipart/form-data { file, order_index, is_primary }
// DELETE /api/photos?photo_id=

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

const BUCKET = 'profile-photos'
const MAX_FILE_SIZE_MB = 5
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) return NextResponse.json({ error: 'Create a profile first.' }, { status: 403 })

  // Check existing photo count (max 4 per PRD)
  const { count } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', myProfile.id)

  if ((count ?? 0) >= 4) {
    return NextResponse.json({ error: 'Maximum 4 photos allowed.' }, { status: 422 })
  }

  const form = await request.formData()
  const file        = form.get('file') as File | null
  const orderIndex  = parseInt(form.get('order_index') as string || '0')
  const isPrimary   = form.get('is_primary') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 422 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP are allowed.' }, { status: 422 })
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return NextResponse.json({ error: `File must be under ${MAX_FILE_SIZE_MB}MB.` }, { status: 422 })
  }

  // Storage path: profile_id/timestamp.ext
  const ext = file.type.split('/')[1]
  const storagePath = `${myProfile.id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  // If this is primary, unset existing primary
  if (isPrimary) {
    await supabase
      .from('photos')
      .update({ is_primary: false })
      .eq('profile_id', myProfile.id)
      .eq('is_primary', true)
  }

  const { data: photo, error: dbError } = await supabase
    .from('photos')
    .insert({
      profile_id:   myProfile.id,
      storage_path: storagePath,
      order_index:  orderIndex,
      is_primary:   isPrimary || (count === 0), // first photo is always primary
    })
    .select()
    .single()

  if (dbError) {
    // Clean up uploaded file if DB insert fails
    await supabase.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 400 })
  }

  return NextResponse.json({ photo }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) return NextResponse.json({ error: 'No profile found.' }, { status: 403 })

  const photoId = request.nextUrl.searchParams.get('photo_id')
  if (!photoId) return NextResponse.json({ error: 'photo_id is required.' }, { status: 422 })

  const { data: photo } = await supabase
    .from('photos')
    .select('storage_path, is_primary')
    .eq('id', photoId)
    .eq('profile_id', myProfile.id)
    .maybeSingle()

  if (!photo) return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })

  // Delete from storage
  await supabase.storage.from(BUCKET).remove([photo.storage_path])

  // Delete DB record
  await supabase.from('photos').delete().eq('id', photoId)

  // If was primary, promote the first remaining photo
  if (photo.is_primary) {
    const { data: remaining } = await supabase
      .from('photos')
      .select('id')
      .eq('profile_id', myProfile.id)
      .order('order_index')
      .limit(1)
      .maybeSingle()

    if (remaining) {
      await supabase.from('photos').update({ is_primary: true }).eq('id', remaining.id)
    }
  }

  return NextResponse.json({ message: 'Photo deleted.' })
}
