-- MeraDarzi Supabase migration and manual hardening guide.
-- Run executable sections in Supabase SQL Editor after a backup.

-- ================================================================
-- 1) Performance indexes for orders, dashboards, payments, reports
-- ================================================================

create index if not exists idx_orders_shop_status
  on public.orders (shop_id, status)
  where deleted_at is null;

create index if not exists idx_orders_shop_due_date
  on public.orders (shop_id, due_date)
  where deleted_at is null;

create index if not exists idx_orders_shop_customer_id
  on public.orders (shop_id, customer_id)
  where deleted_at is null;

create index if not exists idx_orders_shop_order_number
  on public.orders (shop_id, order_number)
  where deleted_at is null;

create index if not exists idx_orders_shop_created_at
  on public.orders (shop_id, created_at desc)
  where deleted_at is null;

create index if not exists idx_orders_shop_assigned_to
  on public.orders (shop_id, assigned_to)
  where deleted_at is null;

create index if not exists idx_payments_shop_paid_at
  on public.payments (shop_id, paid_at desc)
  where deleted_at is null;

create index if not exists idx_payments_order_id
  on public.payments (order_id)
  where deleted_at is null;

create index if not exists idx_customers_shop_last_order
  on public.customers (shop_id, last_order_at desc)
  where deleted_at is null;

create index if not exists idx_team_members_shop_active
  on public.team_members (shop_id, is_active)
  where deleted_at is null;

-- ================================================================
-- 2) Push API subscription storage
-- ================================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  member_id uuid null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_shop
  on public.push_subscriptions (shop_id, last_seen_at desc);

-- ================================================================
-- 3) Tenant column backfills for related tables
-- ================================================================

alter table if exists public.order_status_history
  add column if not exists shop_id uuid;

update public.order_status_history h
set shop_id = o.shop_id
from public.orders o
where h.order_id = o.id
  and h.shop_id is null;

alter table if exists public.order_photos
  add column if not exists shop_id uuid;

update public.order_photos p
set shop_id = o.shop_id
from public.orders o
where p.order_id = o.id
  and p.shop_id is null;

create index if not exists idx_order_status_history_shop_order
  on public.order_status_history (shop_id, order_id, changed_at desc);

create index if not exists idx_order_photos_shop_order
  on public.order_photos (shop_id, order_id)
  where deleted_at is null;

-- ================================================================
-- 4) RLS manual implementation guide
-- ================================================================
--
-- IMPORTANT: Do not enable these policies until the app uses Supabase Auth
-- sessions/JWTs containing shop_id. The current local app session plus anon-key
-- browser client will be blocked by strict RLS.
--
-- Step A: Add a shop_id claim to Supabase Auth users.
-- Recommended: create one Supabase Auth user per owner/karigar, then store
-- app_metadata.shop_id and app_metadata.role.
--
-- Step B: Replace local-only login with Supabase Auth login/session.
-- The browser client must send a JWT where:
--   auth.jwt() -> 'app_metadata' ->> 'shop_id' = current shop id
--
-- Step C: Create a helper function:
--
-- create or replace function public.current_shop_id()
-- returns uuid
-- language sql
-- stable
-- as $$
--   select nullif(auth.jwt() -> 'app_metadata' ->> 'shop_id', '')::uuid
-- $$;
--
-- Step D: Enable RLS and add tenant policies table-by-table:
--
-- alter table public.orders enable row level security;
-- create policy "orders tenant select" on public.orders
--   for select using (shop_id = public.current_shop_id());
-- create policy "orders tenant insert" on public.orders
--   for insert with check (shop_id = public.current_shop_id());
-- create policy "orders tenant update" on public.orders
--   for update using (shop_id = public.current_shop_id())
--   with check (shop_id = public.current_shop_id());
-- create policy "orders tenant delete" on public.orders
--   for delete using (shop_id = public.current_shop_id());
--
-- Repeat the same policy shape for:
-- public.customers, public.measurements, public.payments,
-- public.team_members, public.order_status_history, public.order_photos,
-- public.push_subscriptions, public.shop_usage, public.subscriptions,
-- public.subscription_payments.
--
-- Shops table usually needs a narrower policy:
--
-- alter table public.shops enable row level security;
-- create policy "shops tenant select" on public.shops
--   for select using (id = public.current_shop_id());
-- create policy "shops tenant update" on public.shops
--   for update using (id = public.current_shop_id())
--   with check (id = public.current_shop_id());
--
-- Step E: Keep admin/server routes on SUPABASE_SERVICE_ROLE_KEY.
-- Service role bypasses RLS and must never be exposed to the browser.

-- ================================================================
-- 5) Push delivery manual steps
-- ================================================================
--
-- Step A: Generate VAPID keys:
--   npx web-push generate-vapid-keys
--
-- Step B: Add env vars in Vercel and local .env.local:
--   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
--   VAPID_PRIVATE_KEY=...
--   VAPID_SUBJECT=mailto:you@example.com
--
-- Step C: Install a push sender library:
--   npm install web-push
--   npm install -D @types/web-push
--
-- Step D: Add a server route or cron that reads public.push_subscriptions
-- and sends Web Push payloads for overdue/due orders. Subscription collection
-- is now implemented in the app; encrypted remote delivery needs the library
-- above.

