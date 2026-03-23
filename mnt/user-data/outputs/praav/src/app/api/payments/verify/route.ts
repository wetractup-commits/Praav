// ============================================================
// PRAAV — Payment Verification + SKU Fulfilment
// src/app/api/payments/verify/route.ts
// ============================================================
// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, sku, metadata? }
//
// 1. Verifies Razorpay HMAC signature
// 2. Marks transaction as success
// 3. Fulfils the SKU (publish profile, enable incognito, etc.)

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

  // ── 1. Verify HMAC signature ──────────────────────────────
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid payment signature.' }, { status: 400 })
  }

  // ── 2. Find the pending transaction ──────────────────────
  const { data: tx } = await service
    .from('transactions')
    .select('id, sku, metadata')
    .eq('razorpay_order_id', razorpay_order_id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (!tx) {
    return NextResponse.json({ error: 'Transaction not found or already processed.' }, { status: 404 })
  }

  // ── 3. Mark as success ───────────────────────────────────
  await service
    .from('transactions')
    .update({
      razorpay_payment_id,
      razorpay_signature,
      status: 'success',
    })
    .eq('id', tx.id)

  // ── 4. Fulfil the SKU ────────────────────────────────────
  const { data: myProfile } = await service
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  let fulfillmentResult: Record<string, unknown> = {}

  switch (sku) {
    case 'profile_publish':
      // Profile is already published during POST /api/profile creation
      // This just ensures the transaction is recorded — profile was gated on it
      fulfillmentResult = { action: 'profile_published' }
      break

    case 'incognito_month':
      if (myProfile) {
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        await service
          .from('profiles')
          .update({ is_incognito: true, incognito_expires_at: expiresAt })
          .eq('id', myProfile.id)
        fulfillmentResult = { action: 'incognito_enabled', expires_at: expiresAt }
      }
      break

    case 'highlight_profile':
      if (myProfile) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        await service
          .from('profiles')
          .update({ is_highlighted: true, highlight_expires_at: expiresAt })
          .eq('id', myProfile.id)
        fulfillmentResult = { action: 'highlight_enabled', expires_at: expiresAt }
      }
      break

    case 'repost_profile':
      if (myProfile) {
        // Bump last_active_at to resurface in feed
        await service
          .from('profiles')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', myProfile.id)
        fulfillmentResult = { action: 'profile_reposted' }
      }
      break

    case 'contact_reveal': {
      const revealedId = (metadata.revealed_profile_id ?? tx.metadata?.revealed_profile_id) as string | undefined
      if (myProfile && revealedId) {
        await service
          .from('contact_reveals')
          .insert({ revealer_id: myProfile.id, revealed_id: revealedId })
          .onConflict('revealer_id, revealed_id')
          .ignore()
        fulfillmentResult = { action: 'contact_revealed', revealed_profile_id: revealedId }
      }
      break
    }
  }

  return NextResponse.json({ success: true, fulfillment: fulfillmentResult })
}
