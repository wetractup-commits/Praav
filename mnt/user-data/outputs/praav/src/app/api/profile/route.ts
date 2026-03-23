// ============================================================
// PRAAV — Profile API
// src/app/api/profile/route.ts
// ============================================================
// GET  /api/profile          — get own profile
// POST /api/profile          — create profile (requires profile_publish payment)
// PATCH /api/profile         — update profile fields

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'

// ── GET own profile ───────────────────────────────────────────
export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      photos ( id, storage_path, order_index, is_primary ),
      profile_interests (
        interests ( id, label, emoji )
      )
    `)
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ profile: data })
}

// ── POST create profile ───────────────────────────────────────
// Gate: user must have a successful profile_publish transaction.
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  // Check payment gate
  const { data: tx } = await service
    .from('transactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('sku', 'profile_publish')
    .eq('status', 'success')
    .limit(1)
    .maybeSingle()

  if (!tx) {
    return NextResponse.json(
      { error: 'Profile creation requires a completed payment.', code: 'PAYMENT_REQUIRED' },
      { status: 402 }
    )
  }

  const body = await request.json()
  const {
    display_name, age, city, gender, gender_custom,
    orientation, intent, bio, religion,
    interest_ids = [],
  } = body

  // Basic validation
  const validationError = validateProfileFields({ display_name, age, city, gender, orientation, intent })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

  // Create profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      user_id: user.id,
      display_name: display_name.trim(),
      age: Number(age),
      city: city.trim(),
      gender,
      gender_custom: gender_custom?.trim() || null,
      orientation,
      intent,
      bio: bio?.trim() || null,
      religion: religion || 'prefer_not_to_say',
      is_published: true,
    })
    .select()
    .single()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  // Add interests
  if (interest_ids.length > 0 && interest_ids.length <= 5) {
    await supabase.from('profile_interests').insert(
      interest_ids.map((id: string) => ({ profile_id: profile.id, interest_id: id }))
    )
  }

  return NextResponse.json({ profile }, { status: 201 })
}

// ── PATCH update profile ──────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const body = await request.json()
  const allowed = ['display_name', 'bio', 'city', 'orientation', 'intent', 'religion', 'gender_custom']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ profile: data })
}

// ── Validation helper ─────────────────────────────────────────
function validateProfileFields(fields: {
  display_name: string
  age: number
  city: string
  gender: string
  orientation: string[]
  intent: string[]
}): string | null {
  if (!fields.display_name || fields.display_name.trim().length < 2)
    return 'Display name must be at least 2 characters.'
  if (!fields.age || fields.age < 18 || fields.age > 100)
    return 'Age must be between 18 and 100.'
  if (!fields.city || fields.city.trim().length < 2)
    return 'City is required.'
  if (!fields.gender)
    return 'Gender is required.'
  if (!fields.orientation || fields.orientation.length === 0)
    return 'At least one orientation is required.'
  if (!fields.intent || fields.intent.length === 0)
    return 'At least one relationship intent is required.'
  return null
}
