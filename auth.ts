// ============================================================
// PRAAV — Auth Store (Zustand)
// src/lib/stores/auth.ts
// ============================================================
// Holds the current user session on the client.
// Initialised by AuthProvider on mount.

import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/types/database'

interface AuthState {
  user:        User | null
  session:     Session | null
  profile:     Profile | null
  isLoading:   boolean

  setUser:     (user: User | null) => void
  setSession:  (session: Session | null) => void
  setProfile:  (profile: Profile | null) => void
  setLoading:  (loading: boolean) => void
  reset:       () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  session:   null,
  profile:   null,
  isLoading: true,

  setUser:    (user)    => set({ user }),
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({ user: null, session: null, profile: null, isLoading: false }),
}))
