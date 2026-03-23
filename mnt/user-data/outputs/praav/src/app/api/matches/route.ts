// ============================================================
// PRAAV — Matches API
// src/app/api/matches/route.ts
// ============================================================
// GET /api/matches — list all matches with last message and profile

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) return NextResponse.json({ matches: [] })

  const pid = myProfile.id

  // Fetch matches where user is either side
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      id, created_at, profile_a_id, profile_b_id,
      messages ( id, body, sent_at, sender_id, is_read )
    `)
    .or(`profile_a_id.eq.${pid},profile_b_id.eq.${pid}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // For each match, fetch the other profile
  const enriched = await Promise.all(
    (matches || []).map(async (match) => {
      const otherId = match.profile_a_id === pid ? match.profile_b_id : match.profile_a_id

      const { data: otherProfile } = await supabase
        .from('profiles')
        .select(`
          id, display_name, age, city, is_incognito,
          photos ( storage_path, is_primary )
        `)
        .eq('id', otherId)
        .single()

      const msgs = (match.messages as { id: string; body: string; sent_at: string; sender_id: string; is_read: boolean }[] | null) ?? []
      const sortedMsgs = [...msgs].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      const lastMessage = sortedMsgs[0] ?? null
      const unreadCount = msgs.filter(m => !m.is_read && m.sender_id !== pid).length

      return {
        id: match.id,
        created_at: match.created_at,
        other_profile: otherProfile,
        last_message: lastMessage,
        unread_count: unreadCount,
      }
    })
  )

  return NextResponse.json({ matches: enriched })
}
