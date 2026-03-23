// ============================================================
// PRAAV — Database Types
// src/types/database.ts
// ============================================================

export type GenderType =
  | 'man' | 'woman' | 'non_binary' | 'transgender_man' | 'transgender_woman'
  | 'genderqueer' | 'agender' | 'other' | 'prefer_not_to_say'

export type OrientationType =
  | 'straight' | 'gay' | 'lesbian' | 'bisexual' | 'pansexual'
  | 'asexual' | 'queer' | 'other' | 'prefer_not_to_say'

export type IntentType =
  | 'dating' | 'long_term' | 'marriage' | 'open_relationship' | 'friendship' | 'not_sure'

export type ReligionType =
  | 'non_religious' | 'spiritual_not_religious' | 'atheist' | 'agnostic'
  | 'questioning' | 'prefer_not_to_say'

export type SkuType =
  | 'profile_publish'
  | 'contact_reveal'
  | 'highlight_profile'
  | 'repost_profile'
  | 'incognito_month'

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'refunded'

export type ReportReason =
  | 'fake_profile' | 'harassment' | 'spam' | 'inappropriate_content'
  | 'underage' | 'scam' | 'other'

// ── Row types ────────────────────────────────────────────────

export interface User {
  id: string
  email: string | null
  phone: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  user_id: string
  display_name: string
  age: number
  city: string
  gender: GenderType
  gender_custom: string | null
  orientation: OrientationType[]
  intent: IntentType[]
  bio: string | null
  religion: ReligionType
  is_published: boolean
  is_incognito: boolean
  is_highlighted: boolean
  highlight_expires_at: string | null
  incognito_expires_at: string | null
  last_active_at: string
  created_at: string
  updated_at: string
}

export interface Photo {
  id: string
  profile_id: string
  storage_path: string
  order_index: number
  is_primary: boolean
  created_at: string
}

export interface Interest {
  id: string
  label: string
  emoji: string | null
}

export interface ProfileInterest {
  profile_id: string
  interest_id: string
}

export interface Like {
  id: string
  from_profile_id: string
  to_profile_id: string
  created_at: string
}

export interface Match {
  id: string
  profile_a_id: string
  profile_b_id: string
  created_at: string
}

export interface Message {
  id: string
  match_id: string
  sender_id: string
  body: string
  sent_at: string
  is_read: boolean
}

export interface ContactReveal {
  id: string
  revealer_id: string
  revealed_id: string
  created_at: string
}

export interface Block {
  id: string
  blocker_id: string
  blocked_id: string
  created_at: string
}

export interface Report {
  id: string
  reporter_id: string
  reported_id: string
  reason: ReportReason
  details: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  sku: SkuType
  amount_inr: number
  currency: string
  razorpay_order_id: string | null
  razorpay_payment_id: string | null
  razorpay_signature: string | null
  status: TransactionStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PricingConfig {
  sku: SkuType
  label: string
  description: string | null
  amount_inr: number
  is_active: boolean
  updated_at: string
}

// ── Enriched types (joins) ────────────────────────────────────

export interface ProfileWithPhotos extends Profile {
  photos: Photo[]
  interests: Interest[]
}

export interface MatchWithProfile extends Match {
  other_profile: ProfileWithPhotos
  last_message: Message | null
  unread_count: number
}

// ── Supabase Database helper type ─────────────────────────────
// Use with createClient<Database>() for full type safety

export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at'>>
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'last_active_at'>
        Update: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at'>>
      }
      photos: {
        Row: Photo
        Insert: Omit<Photo, 'id' | 'created_at'>
        Update: Partial<Omit<Photo, 'id' | 'profile_id' | 'created_at'>>
      }
      interests: { Row: Interest; Insert: Omit<Interest, 'id'>; Update: Partial<Interest> }
      profile_interests: { Row: ProfileInterest; Insert: ProfileInterest; Update: never }
      likes: { Row: Like; Insert: Omit<Like, 'id' | 'created_at'>; Update: never }
      matches: { Row: Match; Insert: Omit<Match, 'id' | 'created_at'>; Update: never }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'sent_at' | 'is_read'>
        Update: Pick<Message, 'is_read'>
      }
      contact_reveals: {
        Row: ContactReveal
        Insert: Omit<ContactReveal, 'id' | 'created_at'>
        Update: never
      }
      blocks: { Row: Block; Insert: Omit<Block, 'id' | 'created_at'>; Update: never }
      reports: {
        Row: Report
        Insert: Omit<Report, 'id' | 'reviewed_at' | 'reviewed_by' | 'created_at'>
        Update: Pick<Report, 'reviewed_at' | 'reviewed_by'>
      }
      transactions: {
        Row: Transaction
        Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Pick<Transaction, 'razorpay_payment_id' | 'razorpay_signature' | 'status'>>
      }
      pricing_config: {
        Row: PricingConfig
        Insert: Omit<PricingConfig, 'updated_at'>
        Update: Partial<PricingConfig>
      }
    }
  }
}
