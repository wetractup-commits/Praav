// ============================================================
// PRAAV — Likes API
// src/app/api/likes/route.ts
// ============================================================
// POST /api/likes  { to_profile_id } — like a profile (auth required)
// GET  /api/likes                    — get received likes count (blurred teaser)

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { to_profile_id } = await request.json()
  if (!to_profile_id) return NextResponse.json({ error: 'to_profile_id is required.' }, { status: 422 })

  // Get my profile
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) {
    return NextResponse.json({ error: 'You must create a profile before liking.' }, { status: 403 })
  }

  if (myProfile.id === to_profile_id) {
    return NextResponse.json({ error: 'You cannot like yourself.' }, { status: 422 })
  }

  // Insert like — trigger in DB will auto-create match if mutual
  const { error } = await supabase
    .from('likes')
    .insert({ from_profile_id: myProfile.id, to_profile_id })

  if (error) {
    // Duplicate like = already liked
    if (error.code === '23505') return NextResponse.json({ status: 'already_liked' })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Check if this created a match
  const { data: match } = await supabase
    .from('matches')
    .select('id')
    .or(
      `and(profile_a_id.eq.${myProfile.id},profile_b_id.eq.${to_profile_id}),` +
      `and(profile_a_id.eq.${to_profile_id},profile_b_id.eq.${myProfile.id})`
    )
    .maybeSingle()

  return NextResponse.json({
    status: match ? 'matched' : 'liked',
    match_id: match?.id ?? null,
  })
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) return NextResponse.json({ count: 0 })

  const { count } = await supabase
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('to_profile_id', myProfile.id)

  return NextResponse.json({ count: count ?? 0 })
}
