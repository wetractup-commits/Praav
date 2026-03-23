// ============================================================
// PRAAV — Payments API
// src/app/api/payments/route.ts
// ============================================================
// POST /api/payments          — create Razorpay order { sku, metadata? }
// POST /api/payments/verify   — verify payment signature & fulfil SKU

import { NextResponse, type NextRequest } from 'next/server'
import crypto from 'crypto'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase'
import type { SkuType } from '@/types/database'

// ── Create Razorpay Order ─────────────────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const service  = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised.' }, { status: 401 })

  const { sku, metadata = {} } = await request.json() as { sku: SkuType; metadata?: Record<string, unknown> }

  // Look up live price from DB (never hard-code prices)
  const { data: price } = await service
    .from('pricing_config')
    .select('amount_inr, label')
    .eq('sku', sku)
    .eq('is_active', true)
    .single()

  if (!price) return NextResponse.json({ error: 'Invalid or inactive SKU.' }, { status: 422 })

  // Create Razorpay order via their REST API
  const razorpayKeyId     = process.env.RAZORPAY_KEY_ID!
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET!

  const orderPayload = {
    amount: price.amount_inr,   // already in paise
    currency: 'INR',
    receipt: `praav_${sku}_${Date.now()}`,
    notes: { sku, user_id: user.id, ...metadata },
  }

  const rzpResponse = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
    },
    body: JSON.stringify(orderPayload),
  })

  if (!rzpResponse.ok) {
    const err = await rzpResponse.json()
    return NextResponse.json({ error: err.error?.description ?? 'Razorpay error.' }, { status: 502 })
  }

  const rzpOrder = await rzpResponse.json()

  // Persist pending transaction
  await service.from('transactions').insert({
    user_id: user.id,
    sku,
    amount_inr: price.amount_inr,
    razorpay_order_id: rzpOrder.id,
    status: 'pending',
    metadata,
  })

  return NextResponse.json({
    order_id: rzpOrder.id,
    amount:   price.amount_inr,
    currency: 'INR',
    key_id:   razorpayKeyId,
    name:     'Praav',
    description: price.label,
  })
}
