'use client'
// ============================================================
// PRAAV — useRazorpay hook
// src/lib/hooks/useRazorpay.ts
// ============================================================
// Encapsulates the full Razorpay checkout flow:
//   1. POST /api/payments     → get Razorpay order_id
//   2. Open Razorpay checkout popup
//   3. POST /api/payments/verify → verify signature + fulfil SKU

import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { SkuType } from '@/types/database'

interface RazorpayOptions {
  sku: SkuType
  metadata?: Record<string, unknown>
  onSuccess?: (fulfillment: Record<string, unknown>) => void
  onError?:   (error: string) => void
}

// Razorpay injects window.Razorpay via their CDN script
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void }
  }
}

export function useRazorpay() {
  const [loading, setLoading] = useState(false)

  const checkout = useCallback(async ({
    sku,
    metadata = {},
    onSuccess,
    onError,
  }: RazorpayOptions) => {
    setLoading(true)

    try {
      // Ensure Razorpay script is loaded
      await loadRazorpayScript()

      // Step 1: Create order on our server
      const orderRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, metadata }),
      })
      const order = await orderRes.json()
      if (!orderRes.ok) {
        toast.error(order.error || 'Could not initiate payment.')
        onError?.(order.error)
        return
      }

      // Step 2: Open Razorpay checkout
      const rzp = new window.Razorpay({
        key:         order.key_id,
        amount:      order.amount,
        currency:    order.currency,
        name:        order.name,
        description: order.description,
        order_id:    order.order_id,
        theme:       { color: '#B5294E' },

        handler: async (response: {
          razorpay_order_id:   string
          razorpay_payment_id: string
          razorpay_signature:  string
        }) => {
          // Step 3: Verify + fulfil
          const verifyRes = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              sku,
              metadata,
            }),
          })
          const verifyData = await verifyRes.json()
          if (!verifyRes.ok) {
            toast.error('Payment verification failed. Contact support.')
            onError?.('Verification failed')
            return
          }
          toast.success('Payment successful!')
          onSuccess?.(verifyData.fulfillment)
        },

        modal: {
          ondismiss: () => {
            setLoading(false)
          },
        },

        prefill: {
          // User's name/email can be pre-filled here if available in the store
        },
      })

      rzp.open()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment error.'
      toast.error(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  return { checkout, loading }
}

// ── Load Razorpay JS SDK ──────────────────────────────────────
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK.'))
    document.body.appendChild(script)
  })
}
