// ============================================================
// PRAAV — Auth API Routes
// src/app/api/auth/route.ts
// ============================================================
// POST /api/auth        — email/password signup or login
// POST /api/auth/otp    — phone OTP send & verify
// POST /api/auth/logout — sign out

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

// ── Signup / Login ───────────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const body = await request.json()
  const { action, email, password } = body

  try {
    if (action === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${request.nextUrl.origin}/auth/confirm`,
        },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      return NextResponse.json({
        user: data.user,
        message: data.session
          ? 'Signed up and logged in.'
          : 'Check your email to confirm your account.',
      })
    }

    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return NextResponse.json({ error: error.message }, { status: 401 })

      return NextResponse.json({ user: data.user })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
