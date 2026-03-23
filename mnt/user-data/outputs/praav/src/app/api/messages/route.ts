// ============================================================
// PRAAV — Messages API
// src/app/api/messages/route.ts
// ============================================================
// GET  /api/messages?match_id=  — fetch thread
// POST /api/messages            — send message { match_id, body }

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const match_id = request.nextUrl.searchParams.get('match_id')
  if (!match_id) return NextResponse.json({ error: 'match_id is required.' }, { status: 422 })

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) return NextResponse.json({ error: 'No profile found.' }, { status: 403 })

  // Verify this user is in the match (RLS also enforces this)
  const { data: match } = await supabase
    .from('matches')
    .select('id')
    .eq('id', match_id)
    .or(`profile_a_id.eq.${myProfile.id},profile_b_id.eq.${myProfile.id}`)
    .maybeSingle()

  if (!match) return NextResponse.json({ error: 'Match not found.' }, { status: 404 })

  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .eq('match_id', match_id)
    .order('sent_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Mark messages from the other party as read
  await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('match_id', match_id)
    .neq('sender_id', myProfile.id)
    .eq('is_read', false)

  return NextResponse.json({ messages })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { match_id, body } = await request.json()
  if (!match_id || !body?.trim()) {
    return NextResponse.json({ error: 'match_id and body are required.' }, { status: 422 })
  }
  if (body.trim().length > 2000) {
    return NextResponse.json({ error: 'Message too long.' }, { status: 422 })
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) return NextResponse.json({ error: 'No profile found.' }, { status: 403 })

  const { data: message, error } = await supabase
    .from('messages')
    .insert({ match_id, sender_id: myProfile.id, body: body.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ message }, { status: 201 })
}
