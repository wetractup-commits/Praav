'use client'
// ============================================================
// PRAAV — useRealtimeChat hook
// src/lib/hooks/useRealtimeChat.ts
// ============================================================
// Subscribes to Supabase Realtime for a given match_id.
// New messages arrive live without polling.

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { Message } from '@/types/database'

export function useRealtimeChat(matchId: string | null) {
  const supabase   = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading,  setLoading]  = useState(false)
  const [sending,  setSending]  = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Load initial messages ─────────────────────────────────
  useEffect(() => {
    if (!matchId) return
    setLoading(true)

    fetch(`/api/messages?match_id=${matchId}`)
      .then(r => r.json())
      .then(({ messages: msgs }) => setMessages(msgs ?? []))
      .finally(() => setLoading(false))
  }, [matchId])

  // ── Subscribe to new messages ─────────────────────────────
  useEffect(() => {
    if (!matchId) return

    // Clean up any existing channel
    channelRef.current?.unsubscribe()

    const channel = supabase
      .channel(`match:${matchId}`)
      .on<Message>(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setMessages(prev => {
            // Deduplicate (optimistic updates may already have the message)
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
    }
  }, [matchId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send a message ────────────────────────────────────────
  const send = useCallback(async (body: string) => {
    if (!matchId || !body.trim() || sending) return

    // Optimistic update with a temp id
    const tempId   = `temp_${Date.now()}`
    const tempMsg: Message = {
      id:        tempId,
      match_id:  matchId,
      sender_id: 'me',   // replaced by realtime payload
      body:      body.trim(),
      sent_at:   new Date().toISOString(),
      is_read:   false,
    }
    setMessages(prev => [...prev, tempMsg])
    setSending(true)

    try {
      const res = await fetch('/api/messages', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ match_id: matchId, body: body.trim() }),
      })
      if (!res.ok) {
        // Roll back optimistic update on failure
        setMessages(prev => prev.filter(m => m.id !== tempId))
      }
      // Realtime subscription will add the real message; temp will be deduped
    } finally {
      setSending(false)
    }
  }, [matchId, sending])

  return { messages, loading, sending, send }
}
