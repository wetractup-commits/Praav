'use client'
// ============================================================
// PRAAV — AuthProvider
// src/components/AuthProvider.tsx
// ============================================================
// Wrap the (app) layout with this. It:
//   1. Subscribes to onAuthStateChange
//   2. Fetches own profile after login
//   3. Keeps useAuthStore in sync

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useAuthStore } from '@/lib/stores/auth'
import type { Profile } from '@/types/database'

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setSession, setProfile, setLoading, reset } = useAuthStore()
  const supabase = createClient()

  useEffect(() => {
    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile()
      else setLoading(false)
    })

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile()
        } else {
          reset()
        }
      }
    )

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchProfile() {
    setLoading(true)
    try {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const { profile } = await res.json() as { profile: Profile }
        setProfile(profile)
      }
    } catch {
      // Profile not created yet — that's fine
    } finally {
      setLoading(false)
    }
  }

  return <>{children}</>
}
