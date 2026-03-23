-- ============================================================
-- PRAAV — RLS Policies, Triggers & Indexes
-- Migration: 002_rls_triggers_indexes.sql
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ── HELPER: get current user's profile id ────────────────────
create or replace function auth.profile_id()
returns uuid language sql stable security definer as $$
  select id from profiles where user_id = auth.uid()
$$;

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

alter table users              enable row level security;
alter table profiles           enable row level security;
alter table photos             enable row level security;
alter table profile_interests  enable row level security;
alter table likes              enable row level security;
alter table matches            enable row level security;
alter table messages           enable row level security;
alter table contact_reveals    enable row level security;
alter table blocks             enable row level security;
alter table reports            enable row level security;
alter table transactions       enable row level security;
alter table pricing_config     enable row level security;
alter table interests          enable row level security;

-- ── USERS ────────────────────────────────────────────────────
create policy "Users can view own record"
  on users for select using (id = auth.uid());

create policy "Users can update own record"
  on users for update using (id = auth.uid());

-- ── PRICING CONFIG (public read) ─────────────────────────────
create policy "Anyone can read active prices"
  on pricing_config for select using (is_active = true);

-- ── INTERESTS (public read) ──────────────────────────────────
create policy "Anyone can read interests"
  on interests for select using (true);

-- ── PROFILES ─────────────────────────────────────────────────
-- Anyone (including anonymous) can browse published, non-incognito profiles
create policy "Browse published profiles"
  on profiles for select using (
    is_published = true and is_incognito = false
  );

-- Profile owner can always see their own profile
create policy "Owner sees own profile"
  on profiles for select using (
    user_id = auth.uid()
  );

-- Incognito users: visible ONLY to profiles they have liked
create policy "Incognito profiles visible to liked users"
  on profiles for select using (
    is_published = true
    and is_incognito = true
    and exists (
      select 1 from likes
      where from_profile_id = id          -- this incognito profile liked the viewer
        and to_profile_id = auth.profile_id()
    )
  );

create policy "Owner can update own profile"
  on profiles for update using (user_id = auth.uid());

create policy "Owner can insert own profile"
  on profiles for insert with check (user_id = auth.uid());

-- ── PHOTOS ───────────────────────────────────────────────────
-- Photos inherit profile visibility
create policy "View photos of visible profiles"
  on photos for select using (
    exists (
      select 1 from profiles p
      where p.id = profile_id
        and (
          (p.is_published and not p.is_incognito)
          or p.user_id = auth.uid()
          or (p.is_published and p.is_incognito and exists (
            select 1 from likes l
            where l.from_profile_id = p.id
              and l.to_profile_id = auth.profile_id()
          ))
        )
    )
  );

create policy "Owner manages own photos"
  on photos for all using (
    exists (select 1 from profiles where id = profile_id and user_id = auth.uid())
  );

-- ── PROFILE INTERESTS ────────────────────────────────────────
create policy "View interests of visible profiles"
  on profile_interests for select using (
    exists (
      select 1 from profiles p
      where p.id = profile_id
        and (p.is_published or p.user_id = auth.uid())
    )
  );

create policy "Owner manages own interests"
  on profile_interests for all using (
    exists (select 1 from profiles where id = profile_id and user_id = auth.uid())
  );

-- ── LIKES ────────────────────────────────────────────────────
-- Authenticated users can see likes they sent or received
create policy "See own likes"
  on likes for select using (
    from_profile_id = auth.profile_id()
    or to_profile_id = auth.profile_id()
  );

create policy "Authenticated users can like"
  on likes for insert with check (
    from_profile_id = auth.profile_id()
    and auth.uid() is not null
  );

-- ── MATCHES ──────────────────────────────────────────────────
create policy "Participants see their matches"
  on matches for select using (
    profile_a_id = auth.profile_id()
    or profile_b_id = auth.profile_id()
  );

-- ── MESSAGES ─────────────────────────────────────────────────
create policy "Participants see match messages"
  on messages for select using (
    exists (
      select 1 from matches m
      where m.id = match_id
        and (m.profile_a_id = auth.profile_id() or m.profile_b_id = auth.profile_id())
    )
  );

create policy "Participants can send messages"
  on messages for insert with check (
    sender_id = auth.profile_id()
    and exists (
      select 1 from matches m
      where m.id = match_id
        and (m.profile_a_id = auth.profile_id() or m.profile_b_id = auth.profile_id())
    )
  );

-- ── CONTACT REVEALS ──────────────────────────────────────────
create policy "See your own reveals"
  on contact_reveals for select using (
    revealer_id = auth.profile_id()
  );

create policy "Insert reveals (payment enforced in API)"
  on contact_reveals for insert with check (
    revealer_id = auth.profile_id()
  );

-- ── BLOCKS ───────────────────────────────────────────────────
create policy "See own blocks"
  on blocks for select using (blocker_id = auth.profile_id());

create policy "Create own blocks"
  on blocks for insert with check (blocker_id = auth.profile_id());

create policy "Delete own blocks"
  on blocks for delete using (blocker_id = auth.profile_id());

-- ── REPORTS ──────────────────────────────────────────────────
create policy "Create reports"
  on reports for insert with check (reporter_id = auth.profile_id());

create policy "See own reports"
  on reports for select using (reporter_id = auth.profile_id());

-- ── TRANSACTIONS ─────────────────────────────────────────────
create policy "See own transactions"
  on transactions for select using (user_id = auth.uid());

-- Insert/update only via service role (API routes use service key)

-- ════════════════════════════════════════════════════════════
-- TRIGGERS
-- ════════════════════════════════════════════════════════════

-- 1. Auto-create users row on Supabase Auth signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into users (id, email, phone)
  values (
    new.id,
    new.email,
    new.phone
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. Auto-create match when mutual like is detected
create or replace function handle_mutual_like()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  a_id uuid;
  b_id uuid;
begin
  -- Check if the liked person already liked back
  if exists (
    select 1 from likes
    where from_profile_id = new.to_profile_id
      and to_profile_id = new.from_profile_id
  ) then
    -- Canonical ordering: smaller uuid first (prevents dupes)
    a_id := least(new.from_profile_id, new.to_profile_id);
    b_id := greatest(new.from_profile_id, new.to_profile_id);

    insert into matches (profile_a_id, profile_b_id)
    values (a_id, b_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace trigger on_like_inserted
  after insert on likes
  for each row execute function handle_mutual_like();

-- 3. Keep updated_at current
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on users
  for each row execute function touch_updated_at();

create trigger profiles_updated_at
  before update on profiles
  for each row execute function touch_updated_at();

create trigger transactions_updated_at
  before update on transactions
  for each row execute function touch_updated_at();

create trigger pricing_config_updated_at
  before update on pricing_config
  for each row execute function touch_updated_at();

-- 4. Expire highlights and incognito automatically
create or replace function expire_profile_flags()
returns trigger language plpgsql as $$
begin
  if new.highlight_expires_at is not null
     and new.highlight_expires_at < now() then
    new.is_highlighted := false;
    new.highlight_expires_at := null;
  end if;

  if new.incognito_expires_at is not null
     and new.incognito_expires_at < now() then
    new.is_incognito := false;
    new.incognito_expires_at := null;
  end if;

  return new;
end;
$$;

create trigger profiles_expire_flags
  before update on profiles
  for each row execute function expire_profile_flags();

-- ════════════════════════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════════════════════════

-- Discovery feed: published, not incognito, recently active
create index profiles_discovery_idx
  on profiles (is_published, is_incognito, last_active_at desc)
  where is_published = true and is_incognito = false;

-- Highlighted profiles (appear first in feed)
create index profiles_highlighted_idx
  on profiles (is_highlighted, highlight_expires_at)
  where is_highlighted = true;

-- Likes lookup (mutual like check is hot path)
create index likes_to_profile_idx on likes (to_profile_id);
create index likes_from_profile_idx on likes (from_profile_id);

-- Matches per user
create index matches_a_idx on matches (profile_a_id);
create index matches_b_idx on matches (profile_b_id);

-- Messages per match (for chat threads)
create index messages_match_idx on messages (match_id, sent_at desc);

-- Transactions lookup
create index transactions_user_idx on transactions (user_id, created_at desc);
create index transactions_razorpay_order_idx on transactions (razorpay_order_id);

-- Blocks: fast exclusion in discovery queries
create index blocks_blocker_idx on blocks (blocker_id);
create index blocks_blocked_idx on blocks (blocked_id);

-- ════════════════════════════════════════════════════════════
-- REALTIME (enable for chat)
-- ════════════════════════════════════════════════════════════
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table matches;
