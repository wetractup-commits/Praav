// ============================================================
// PRAAV — OTP Auth API
// src/app/api/auth/otp/route.ts
// ============================================================
// POST { action: 'send', phone }   — sends SMS OTP via Supabase
// POST { action: 'verify', phone, token } — verifies OTP, creates session

import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const body = await request.json()
  const { action, phone, token } = body

  // Normalise Indian numbers: strip spaces, ensure +91 prefix
  const normalised = normalisePhone(phone)
  if (!normalised) {
    return NextResponse.json({ error: 'Invalid phone number.' }, { status: 400 })
  }

  try {
    if (action === 'send') {
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalised,
        options: { channel: 'sms' },
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ message: 'OTP sent.' })
    }

    if (action === 'verify') {
      if (!token || token.length !== 6) {
        return NextResponse.json({ error: 'Token must be 6 digits.' }, { status: 400 })
      }
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalised,
        token,
        type: 'sms',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 401 })
      return NextResponse.json({ user: data.user })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

function normalisePhone(raw: string): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  // 10-digit Indian number
  if (digits.length === 10) return `+91${digits}`
  // Already includes country code
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
  if (digits.length === 13 && digits.startsWith('091')) return `+${digits.slice(1)}`
  return null
}
