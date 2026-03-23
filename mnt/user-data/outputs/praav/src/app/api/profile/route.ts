// ============================================================
// PRAAV — Profile API (updated)
// src/app/api/profile/route.ts
//
// Flow:
//   POST without payment → 402, client triggers Razorpay
//   POST after payment verified → profile created & published
//   The payment verify webhook calls fulfilment which marks
//   is_published = true, so this route just checks for that.
//
// Two-phase approach used here:
//   1. Client calls POST → gets 402 if no payment exists
//   2. useRazorpay hook opens checkout, on success calls /verify
//   3. /verify fulfils SKU (sets is_published = true if profile exists,
//      or stores payment so next POST succeeds)
//   4. Client retries POST → succeeds now
// ============================================================

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'

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
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ profile: null })
  return NextResponse.json({ profile: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  // Check for a successful profile_publish payment
  const { data: tx } = await service
    .from('transactions')
    .select('id')
    .eq('user_id', user.id)
    .eq('sku', 'profile_publish')
    .eq('status', 'success')
    .limit(1)
    .maybeSingle()

  if (!tx) {
    // No payment yet — tell the client to open Razorpay
    return NextResponse.json(
      { error: 'Payment required to publish profile.', code: 'PAYMENT_REQUIRED' },
      { status: 402 }
    )
  }

  const body = await request.json()
  const {
    display_name, age, city, gender, gender_custom,
    orientation, intent, bio, religion,
    interest_ids = [],
  } = body

  const validationError = validateProfileFields({ display_name, age, city, gender, orientation, intent })
  if (validationError) return NextResponse.json({ error: validationError }, { status: 422 })

  // Upsert — in case user retries after a failed attempt
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      user_id:       user.id,
      display_name:  display_name.trim(),
      age:           Number(age),
      city:          city.trim(),
      gender,
      gender_custom: gender_custom?.trim() || null,
      orientation:   Array.isArray(orientation) ? orientation : [orientation],
      intent:        Array.isArray(intent) ? intent : [intent],
      bio:           bio?.trim() || null,
      religion:      religion || 'prefer_not_to_say',
      is_published:  true,
    }, { onConflict: 'user_id' })
    .select()
    .single()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 })

  // Replace interests
  if (profile) {
    await supabase
      .from('profile_interests')
      .delete()
      .eq('profile_id', profile.id)

    if (interest_ids.length > 0) {
      await supabase.from('profile_interests').insert(
        interest_ids.slice(0, 6).map((id: string) => ({
          profile_id: profile.id,
          interest_id: id,
        }))
      )
    }
  }

  return NextResponse.json({ profile }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const body = await request.json()
  const allowed = ['display_name', 'bio', 'city', 'orientation', 'intent', 'religion', 'gender_custom', 'is_incognito']
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

function validateProfileFields(fields: {
  display_name: string; age: number; city: string
  gender: string; orientation: string[]; intent: string[]
}): string | null {
  if (!fields.display_name?.trim() || fields.display_name.trim().length < 2)
    return 'Display name must be at least 2 characters.'
  if (!fields.age || Number(fields.age) < 18 || Number(fields.age) > 100)
    return 'Age must be between 18 and 100.'
  if (!fields.city?.trim() || fields.city.trim().length < 2)
    return 'City is required.'
  if (!fields.gender)
    return 'Gender is required.'
  if (!fields.orientation || (Array.isArray(fields.orientation) && fields.orientation.length === 0))
    return 'At least one orientation is required.'
  if (!fields.intent || (Array.isArray(fields.intent) && fields.intent.length === 0))
    return 'Relationship intent is required.'
  return null
}
