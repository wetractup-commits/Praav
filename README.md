# Praav — Developer Setup Guide

> **Stack:** Next.js 14 · Supabase · Razorpay · Vercel  
> **Phase:** 1 — Web MVP

---

## 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier is fine to start)
- A [Razorpay](https://razorpay.com) account (use test mode initially)
- A [Resend](https://resend.com) account (free tier: 100 emails/day)

---

## 2. Clone & Install

```bash
git clone <your-repo>
cd praav
npm install
```

---

## 3. Supabase Setup

### 3.1 Create a new project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Choose a region close to your users — **ap-south-1 (Mumbai)** for India
4. Note down your **Project URL** and **API keys** (Settings → API)

### 3.2 Run the migrations

In the Supabase dashboard, open **SQL Editor** and run these files **in order**:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_rls_triggers_indexes.sql
```

Or, if you have the Supabase CLI installed:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### 3.3 Create the Storage bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New bucket**
3. Name it exactly: `profile-photos`
4. Set to **Private** (NOT public — photos use signed URLs)
5. Set file size limit to **5MB**
6. Allowed MIME types: `image/jpeg, image/png, image/webp`

### 3.4 Configure Auth

In **Authentication → Settings**:

- **Site URL:** `http://localhost:3000` (dev) / `https://yourdomain.com` (prod)
- **Redirect URLs:** Add `http://localhost:3000/auth/confirm`
- **Phone OTP provider:** Enable Twilio or MSG91 for SMS (required for phone login)
- Optional: Disable email confirmation for faster local development

---

## 4. Razorpay Setup

1. Sign up at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Go to **Settings → API Keys**
3. Generate a key pair (use **Test Mode** keys during development — prefix `rzp_test_`)
4. Your **Key ID** is public (goes in `NEXT_PUBLIC_RAZORPAY_KEY_ID`)
5. Your **Key Secret** is private (goes in `RAZORPAY_KEY_SECRET` — never expose to browser)

---

## 5. Environment Variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...

RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=hello@praav.in

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## 6. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## 7. Project Structure

```
praav/
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql     ← Tables, enums, seed data
│       └── 002_rls_triggers_indexes.sql ← RLS, triggers, indexes
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx         ← Email + OTP login
│   │   │   └── signup/page.tsx        ← New account creation
│   │   ├── (app)/
│   │   │   ├── layout.tsx             ← AuthProvider wraps all app routes
│   │   │   ├── discover/page.tsx      ← Browse feed (build next)
│   │   │   ├── matches/page.tsx       ← Matches list (build next)
│   │   │   ├── chat/[matchId]/page.tsx ← Chat thread (build next)
│   │   │   ├── profile/page.tsx       ← Own profile (build next)
│   │   │   └── profile-builder/page.tsx ← 6-step builder (build next)
│   │   ├── api/
│   │   │   ├── auth/route.ts          ← Email signup/login
│   │   │   ├── auth/otp/route.ts      ← Phone OTP
│   │   │   ├── auth/logout/route.ts   ← Sign out
│   │   │   ├── profile/route.ts       ← CRUD own profile
│   │   │   ├── discover/route.ts      ← Feed with filters
│   │   │   ├── likes/route.ts         ← Like profiles
│   │   │   ├── matches/route.ts       ← List matches
│   │   │   ├── messages/route.ts      ← Chat messages
│   │   │   ├── photos/route.ts        ← Photo upload/delete
│   │   │   ├── safety/route.ts        ← Report & block
│   │   │   ├── payments/route.ts      ← Create Razorpay order
│   │   │   └── payments/verify/route.ts ← Verify + fulfil SKU
│   │   ├── auth/confirm/route.ts      ← Email confirmation callback
│   │   ├── layout.tsx                 ← Root layout + Toaster
│   │   └── globals.css                ← Brand tokens + animations
│   │
│   ├── components/
│   │   └── AuthProvider.tsx           ← Supabase session → Zustand store
│   │
│   ├── lib/
│   │   ├── supabase.ts                ← Browser, server, service clients
│   │   ├── storage.ts                 ← Signed URL helpers
│   │   ├── stores/auth.ts             ← Zustand auth store
│   │   ├── hooks/useRazorpay.ts       ← Full checkout flow hook
│   │   └── hooks/useRealtimeChat.ts   ← Supabase Realtime chat hook
│   │
│   ├── types/
│   │   └── database.ts                ← TypeScript types for all tables
│   │
│   └── middleware.ts                  ← Session refresh + route protection
│
├── .env.example                       ← Copy to .env.local
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 8. Build Order (PRD §11)

Build in this sequence — each step is independently shippable:

| # | What | Key files |
|---|------|-----------|
| ✅ | Auth + Supabase | `api/auth/*`, `middleware.ts`, stores |
| ✅ | Payments foundation | `api/payments/*`, `useRazorpay` hook |
| ✅ | DB schema + RLS | `migrations/001`, `migrations/002` |
| 🔜 | Profile builder UI | `app/(app)/profile-builder/page.tsx` |
| 🔜 | Browse feed UI | `app/(app)/discover/page.tsx` |
| 🔜 | Swipe + match logic | Wire `api/likes` to discover UI |
| 🔜 | Chat UI | Wire `useRealtimeChat` to chat page |
| 🔜 | Paid actions UI | Highlight, repost, contact reveal modals |
| 🔜 | Admin panel | Report queue, pricing editor |

---

## 9. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

Update in Supabase:
- **Site URL** → your Vercel domain
- **Redirect URLs** → add `https://yourdomain.com/auth/confirm`

---

## 10. Key Design Decisions

### Prices live in the database
All prices are in `pricing_config`. To change a price, update the table — no code deploy needed.

### RLS enforces privacy at the database level
Incognito profiles are excluded from queries at the Postgres level — it's not just hidden in the UI. A user with incognito enabled truly cannot be found in the browse feed.

### Service role key only in API routes
The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. It is only used in server-side API routes (payment webhooks, SKU fulfilment). Never import `createServiceClient()` in a client component.

### Signed photo URLs
Profile photos are in a private bucket. URLs expire after 1 hour. This means a guessed URL from a screenshot won't work after the session ends.

### Mutual like → match is a database trigger
The `handle_mutual_like()` trigger fires on every `INSERT` into `likes`. This means the match is created atomically — no race condition possible from two users liking simultaneously.
