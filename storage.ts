// ============================================================
// PRAAV — Storage helpers
// src/lib/storage.ts
// ============================================================
// Profile photos are stored as private objects in Supabase Storage.
// They are served via signed URLs (60-min expiry) — never public.

import { createClient } from '@/lib/supabase'

const BUCKET = 'profile-photos'

/**
 * Get a signed URL for a storage path.
 * Expires in 1 hour. Rotate on re-render if needed.
 */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60) // 1 hour

  if (error || !data) return null
  return data.signedUrl
}

/**
 * Get signed URLs for multiple paths in one call.
 */
export async function getSignedUrls(storagePaths: string[]): Promise<Record<string, string>> {
  if (!storagePaths.length) return {}
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(storagePaths, 60 * 60)

  if (error || !data) return {}
  return Object.fromEntries(
    data
      .filter(d => d.signedUrl)
      .map(d => [d.path, d.signedUrl!])
  )
}

/**
 * Upload a File object and return the storage path.
 * Use POST /api/photos for server-side validation instead of calling this directly.
 */
export async function uploadPhoto(
  profileId: string,
  file: File
): Promise<{ path: string } | { error: string }> {
  const supabase = createClient()
  const ext  = file.type.split('/')[1]
  const path = `${profileId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type })

  if (error) return { error: error.message }
  return { path }
}
