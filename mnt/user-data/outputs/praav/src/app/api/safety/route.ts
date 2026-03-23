// ============================================================
// PRAAV — Report & Block API
// src/app/api/safety/route.ts
// ============================================================
// POST /api/safety  { action: 'report' | 'block', profile_id, reason?, details? }

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { ReportReason } from '@/types/database'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { action, profile_id, reason, details } = await request.json()

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!myProfile) return NextResponse.json({ error: 'No profile found.' }, { status: 403 })

  if (myProfile.id === profile_id) {
    return NextResponse.json({ error: 'Cannot report or block yourself.' }, { status: 422 })
  }

  if (action === 'report') {
    if (!reason) return NextResponse.json({ error: 'Reason is required.' }, { status: 422 })

    const { error } = await supabase.from('reports').insert({
      reporter_id: myProfile.id,
      reported_id: profile_id,
      reason: reason as ReportReason,
      details: details?.trim() || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ message: 'Report submitted. Our team will review within 24 hours.' })
  }

  if (action === 'block') {
    const { error } = await supabase.from('blocks').insert({
      blocker_id: myProfile.id,
      blocked_id: profile_id,
    })

    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ message: 'User blocked.' })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
