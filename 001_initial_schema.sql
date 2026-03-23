-- ============================================================
-- PRAAV — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── ENUM Types ───────────────────────────────────────────────
create type gender_type as enum (
  'man', 'woman', 'non_binary', 'transgender_man', 'transgender_woman',
  'genderqueer', 'agender', 'other', 'prefer_not_to_say'
);

create type orientation_type as enum (
  'straight', 'gay', 'lesbian', 'bisexual', 'pansexual',
  'asexual', 'queer', 'other', 'prefer_not_to_say'
);

create type intent_type as enum (
  'dating', 'long_term', 'marriage', 'open_relationship', 'friendship', 'not_sure'
);

create type religion_type as enum (
  'non_religious', 'spiritual_not_religious', 'atheist', 'agnostic',
  'questioning', 'prefer_not_to_say'
);

create type transaction_status as enum ('pending', 'success', 'failed', 'refunded');

create type sku_type as enum (
  'profile_publish',   -- ₹199 one-time: create & publish profile
  'contact_reveal',    -- ₹99 per reveal: see phone/email of a match
  'highlight_profile', -- ₹149: feature profile at top of feed for 24h
  'repost_profile',    -- ₹79: re-surface profile to new users
  'incognito_month'    -- ₹249/month: browse invisibly
);

-- ── PRICING CONFIG ───────────────────────────────────────────
-- Admin-editable. Never hard-code prices in application code.
create table pricing_config (
  sku           sku_type primary key,
  label         text not null,
  description   text,
  amount_inr    integer not null,  -- in paise (₹199 = 19900)
  is_active     boolean default true,
  updated_at    timestamptz default now()
);

insert into pricing_config (sku, label, description, amount_inr) values
  ('profile_publish',   'Create Profile',      'Publish your profile with photos', 19900),
  ('contact_reveal',    'Reveal Contact',      'See phone or email of a match',     9900),
  ('highlight_profile', 'Highlight Profile',   'Feature at top of discovery for 24h', 14900),
  ('repost_profile',    'Repost Profile',      'Re-surface to new users',           7900),
  ('incognito_month',   'Incognito Mode',      'Browse and like invisibly for 30 days', 24900);

-- ── USERS ────────────────────────────────────────────────────
-- Mirrors auth.users from Supabase Auth. Created via trigger on signup.
create table users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique,
  phone         text unique,
  is_verified   boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── PROFILES ─────────────────────────────────────────────────
create table profiles (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid unique not null references users(id) on delete cascade,
  display_name      text not null check(char_length(display_name) between 2 and 50),
  age               integer not null check(age between 18 and 100),
  city              text not null,
  gender            gender_type not null,
  gender_custom     text,                   -- if gender = 'other'
  orientation       orientation_type[] not null default '{}',
  intent            intent_type[] not null default '{}',
  bio               text check(char_length(bio) <= 280),
  religion          religion_type default 'prefer_not_to_say',

  -- status flags
  is_published      boolean default false,  -- true after profile_publish payment
  is_incognito      boolean default false,  -- true while incognito_month active
  is_highlighted    boolean default false,
  highlight_expires_at timestamptz,
  incognito_expires_at timestamptz,

  -- discovery index (updated on query for performance)
  last_active_at    timestamptz default now(),

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ── PHOTOS ───────────────────────────────────────────────────
create table photos (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid not null references profiles(id) on delete cascade,
  storage_path  text not null,            -- path in Supabase Storage bucket
  order_index   integer not null default 0,
  is_primary    boolean default false,
  created_at    timestamptz default now()
);

-- Only one primary photo per profile
create unique index photos_primary_idx on photos(profile_id) where is_primary = true;

-- ── INTERESTS ────────────────────────────────────────────────
create table interests (
  id    uuid primary key default uuid_generate_v4(),
  label text unique not null,
  emoji text
);

-- Seed: common interest tags
insert into interests (label, emoji) values
  ('Books', '📚'), ('Films', '🎬'), ('Music', '🎵'), ('Travel', '✈️'),
  ('Hiking', '🥾'), ('Yoga', '🧘'), ('Cooking', '🍳'), ('Photography', '📷'),
  ('Gaming', '🎮'), ('Art', '🎨'), ('Politics', '🗳️'), ('Philosophy', '💭'),
  ('Feminism', '✊'), ('Climate', '🌱'), ('Startups', '🚀'), ('Cycling', '🚴'),
  ('Running', '🏃'), ('Theatre', '🎭'), ('Podcasts', '🎙️'), ('Science', '🔬'),
  ('Writing', '✍️'), ('Astrology', '⭐'), ('Cats', '🐱'), ('Dogs', '🐶'),
  ('Coffee', '☕'), ('Wine', '🍷'), ('Meditation', '🕯️'), ('Dance', '💃');

create table profile_interests (
  profile_id    uuid references profiles(id) on delete cascade,
  interest_id   uuid references interests(id) on delete cascade,
  primary key (profile_id, interest_id)
);

-- ── LIKES ────────────────────────────────────────────────────
create table likes (
  id              uuid primary key default uuid_generate_v4(),
  from_profile_id uuid not null references profiles(id) on delete cascade,
  to_profile_id   uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz default now(),
  unique (from_profile_id, to_profile_id),
  check (from_profile_id <> to_profile_id)
);

-- ── MATCHES ──────────────────────────────────────────────────
-- Created automatically when two users mutually like each other (see trigger).
create table matches (
  id            uuid primary key default uuid_generate_v4(),
  profile_a_id  uuid not null references profiles(id) on delete cascade,
  profile_b_id  uuid not null references profiles(id) on delete cascade,
  created_at    timestamptz default now(),
  unique (profile_a_id, profile_b_id),
  check (profile_a_id < profile_b_id)  -- canonical ordering prevents dupes
);

-- ── MESSAGES ─────────────────────────────────────────────────
create table messages (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references matches(id) on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  body        text not null check(char_length(body) between 1 and 2000),
  sent_at     timestamptz default now(),
  is_read     boolean default false       -- no read receipts shown in Phase 1 UI
);

-- ── CONTACT REVEALS ──────────────────────────────────────────
-- Tracks which contact details a user has paid to reveal.
create table contact_reveals (
  id              uuid primary key default uuid_generate_v4(),
  revealer_id     uuid not null references profiles(id) on delete cascade,
  revealed_id     uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz default now(),
  unique (revealer_id, revealed_id)
);

-- ── BLOCKS ───────────────────────────────────────────────────
create table blocks (
  id              uuid primary key default uuid_generate_v4(),
  blocker_id      uuid not null references profiles(id) on delete cascade,
  blocked_id      uuid not null references profiles(id) on delete cascade,
  created_at      timestamptz default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ── REPORTS ──────────────────────────────────────────────────
create type report_reason as enum (
  'fake_profile', 'harassment', 'spam', 'inappropriate_content',
  'underage', 'scam', 'other'
);

create table reports (
  id              uuid primary key default uuid_generate_v4(),
  reporter_id     uuid not null references profiles(id) on delete cascade,
  reported_id     uuid not null references profiles(id) on delete cascade,
  reason          report_reason not null,
  details         text,
  reviewed_at     timestamptz,
  reviewed_by     uuid references users(id),
  created_at      timestamptz default now()
);

-- ── TRANSACTIONS ─────────────────────────────────────────────
create table transactions (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references users(id) on delete cascade,
  sku                   sku_type not null,
  amount_inr            integer not null,  -- actual amount charged (paise)
  currency              text default 'INR',
  razorpay_order_id     text unique,
  razorpay_payment_id   text unique,
  razorpay_signature    text,
  status                transaction_status default 'pending',
  metadata              jsonb default '{}', -- e.g. { revealed_profile_id: "..." }
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
