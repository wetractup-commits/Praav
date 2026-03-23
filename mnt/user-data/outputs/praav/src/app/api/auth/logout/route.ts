// ============================================================
// PRAAV — Logout API
// src/app/api/auth/logout/route.ts
// ============================================================

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  await supabase.auth.signOut()
  return NextResponse.json({ message: 'Signed out.' })
}
