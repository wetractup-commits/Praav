// ============================================================
// PRAAV — Payment Verify (updated)
// src/app/api/payments/verify/route.ts
//
// For profile_publish SKU:
//   - If profile already exists (user hit pay on step 6) → mark published
//   - Transaction is recorded; POST /api/profile will succeed on retry
// ============================================================

import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import type { SkuType } from '@/types/database'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    sku,
    metadata = {},
  } = await request.json() as {
    razorpay_order_id: string
    razorpay_payment_id: string
    razorpay_signature: string
    sku: SkuType
    metadata?: Record<string, unknown>
  }

  // ── 1. Verify HMAC ────────────────────────────────────────
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid payment signature.' }, { status: 400 })
  }

  // ── 2. Find & mark pending transaction ───────────────────
  const { data: tx } = await service
    .from('transactions')
    .select('id, sku, metadata')
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!tx) {
    return NextResponse.json(
      { error: 'Transaction not found or already processed.' },
      { status: 404 }
    )
  }

  await service
    .from('transactions')
    .update({ razorpay_payment_id, razorpay_signature, status: 'success' })
    .eq('id', tx.id)

  // ── 3. Fulfil SKU ─────────────────────────────────────────
  const { data: myProfile } = await service
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  let fulfillmentResult: Record<string, unknown> = {}

  switch (sku) {
    case 'profile_publish':
      // Profile may not exist yet (user pays first, then POST /api/profile creates it)
      // If it does exist, mark it published.
      if (myProfile) {
        await service
          .from('profiles')
          .update({ is_published: true })
          .eq('id', myProfile.id)
        fulfillmentResult = { action: 'profile_published', profile_id: myProfile.id }
      } else {
        // Payment recorded — POST /api/profile will check for this transaction and succeed
        fulfillmentResult = { action: 'payment_recorded_profile_pending' }
      }
      break

    case 'incognito_month': {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      if (myProfile) {
        await service
          .from('profiles')
          .update({ is_incognito: true, incognito_expires_at: expiresAt })
          .eq('id', myProfile.id)
      }
      fulfillmentResult = { action: 'incognito_enabled', expires_at: expiresAt }
      break
    }

    case 'highlight_profile': {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      if (myProfile) {
        await service
          .from('profiles')
          .update({ is_highlighted: true, highlight_expires_at: expiresAt })
          .eq('id', myProfile.id)
      }
      fulfillmentResult = { action: 'highlight_enabled', expires_at: expiresAt }
      break
    }

    case 'repost_profile':
      if (myProfile) {
        await service
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', myProfile.id)
      }
      fulfillmentResult = { action: 'profile_reposted' }
      break

    case 'contact_reveal': {
      const revealedId = (metadata.revealed_profile_id ?? tx.metadata?.revealed_profile_id) as string | undefined
      if (myProfile && revealedId) {
        await service
          .from('contact_reveals')
          .upsert({ revealer_id: myProfile.id, revealed_id: revealedId })
        fulfillmentResult = { action: 'contact_revealed', revealed_profile_id: revealedId }
      }
      break
    }
  }

  return NextResponse.json({ success: true, fulfillment: fulfillmentResult })
}
