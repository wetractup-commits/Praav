// ============================================================
// PRAAV — Interests API
// src/app/api/interests/route.ts
// ============================================================
// GET /api/interests — returns all seeded interest tags
// Public endpoint — no auth required

import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('interests')
    .select('id, label, emoji')
    .order('label')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ interests: data })
}
