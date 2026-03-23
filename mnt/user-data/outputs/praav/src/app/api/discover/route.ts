// ============================================================
// PRAAV — Discovery Feed API
// src/app/api/discover/route.ts
// ============================================================
// GET /api/discover?city=&min_age=&max_age=&intent=&orientation=&page=

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

const PAGE_SIZE = 10 // PRD: show 10 profiles then natural break

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { searchParams } = request.nextUrl

  // Filters
  const city        = searchParams.get('city')
  const minAge      = parseInt(searchParams.get('min_age') || '18')
  const maxAge      = parseInt(searchParams.get('max_age') || '60')
  const intent      = searchParams.get('intent')       // comma-separated
  const orientation = searchParams.get('orientation')   // comma-separated
  const page        = parseInt(searchParams.get('page') || '0')
  const offset      = page * PAGE_SIZE

  // Get current user's profile id (null for anonymous browsing — allowed by PRD)
  const { data: { user } } = await supabase.auth.getUser()

  let myProfileId: string | null = null
  let blockedIds:  string[] = []
  let likedIds:    string[] = []

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    myProfileId = myProfile?.id ?? null

    if (myProfileId) {
      // Profiles this user has blocked or been blocked by
      const { data: blockRows } = await supabase
        .from('blocks')
        .select('blocked_id, blocker_id')
        .or(`blocker_id.eq.${myProfileId},blocked_id.eq.${myProfileId}`)

      blockedIds = (blockRows || []).flatMap(b =>
        [b.blocked_id, b.blocker_id].filter(id => id !== myProfileId)
      )

      // Profiles this user has already liked (exclude from feed)
      const { data: likeRows } = await supabase
        .from('likes')
        .select('to_profile_id')
        .eq('from_profile_id', myProfileId)

      likedIds = (likeRows || []).map(l => l.to_profile_id)
    }
  }

  // Build query
  let query = supabase
    .from('profiles')
    .select(`
      id, display_name, age, city, gender, orientation, intent,
      bio, religion, is_highlighted, last_active_at,
      photos ( storage_path, order_index, is_primary ),
      profile_interests ( interests ( id, label, emoji ) )
    `, { count: 'exact' })
    .eq('is_published', true)
    .eq('is_incognito', false)
    .gte('age', minAge)
    .lte('age', maxAge)
    .range(offset, offset + PAGE_SIZE - 1)
    .order('is_highlighted', { ascending: false })
    .order('last_active_at', { ascending: false })

  // Exclude self
  if (myProfileId) query = query.neq('id', myProfileId)

  // Exclude blocked
  if (blockedIds.length > 0) query = query.not('id', 'in', `(${blockedIds.join(',')})`)

  // Exclude already liked
  if (likedIds.length > 0) query = query.not('id', 'in', `(${likedIds.join(',')})`)

  // City filter
  if (city) query = query.ilike('city', `%${city}%`)

  // Intent filter (overlap: profile must have at least one of the requested intents)
  if (intent) {
    const intents = intent.split(',').filter(Boolean)
    if (intents.length > 0) query = query.overlaps('intent', intents)
  }

  // Orientation filter
  if (orientation) {
    const orientations = orientation.split(',').filter(Boolean)
    if (orientations.length > 0) query = query.overlaps('orientation', orientations)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({
    profiles: data,
    total: count,
    page,
    has_more: (offset + PAGE_SIZE) < (count ?? 0),
  })
}
