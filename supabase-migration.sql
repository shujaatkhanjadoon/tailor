-- ============================================================
-- Tailor App — Supabase Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 0. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. MISSING DATABASE INDEXES
-- ============================================================

-- shops: index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_shops_created_at ON shops (created_at DESC);

-- customers: foreign key, search, and sorting
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON customers (shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop_id_phone ON customers (shop_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_name_ilike ON customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_last_order_at ON customers (shop_id, last_order_at DESC);

-- orders: foreign keys, filtering, and sorting
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders (shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders (assigned_to);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders (shop_id, due_date);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders (tracking_code);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders (shop_id, order_number);

-- payments: foreign keys and filtering
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON payments (shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments (shop_id, paid_at DESC);

-- team_members: foreign key and lookup
CREATE INDEX IF NOT EXISTS idx_team_members_shop_id ON team_members (shop_id);
CREATE INDEX IF NOT EXISTS idx_team_members_phone ON team_members (phone);

-- order_photos: foreign key
CREATE INDEX IF NOT EXISTS idx_order_photos_order_id ON order_photos (order_id);

-- order_status_history: foreign key
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history (order_id);

-- measurements: foreign key
CREATE INDEX IF NOT EXISTS idx_measurements_customer_id ON measurements (customer_id);

-- subscriptions: foreign key
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id ON subscriptions (shop_id);

-- subscription_payments
CREATE INDEX IF NOT EXISTS idx_sub_payments_shop_id ON subscription_payments (shop_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_paid_at ON subscription_payments (paid_at DESC);

-- shop_usage: foreign key
CREATE INDEX IF NOT EXISTS idx_shop_usage_shop_id ON shop_usage (shop_id);

-- email_verifications: lookup
CREATE INDEX IF NOT EXISTS idx_email_verifications_phone ON email_verifications (phone);

-- ============================================================
-- 2. UNIQUE CONSTRAINTS
-- ============================================================

-- Prevent duplicate customers within a shop by phone
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_shop_id_phone_key;
ALTER TABLE customers ADD CONSTRAINT customers_shop_id_phone_key UNIQUE (shop_id, phone);

-- Prevent duplicate team members within a shop by phone
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_shop_id_phone_key;
ALTER TABLE team_members ADD CONSTRAINT team_members_shop_id_phone_key UNIQUE (shop_id, phone);

-- ============================================================
-- 3. ROW LEVEL SECURITY — CLEANUP FROM PREVIOUS RUNS
-- ============================================================
--
-- The app uses custom PIN-based auth (no Supabase Auth sessions),
-- so auth.uid() is always NULL on client-side anon-key queries.
-- All writes go through service-role API routes which bypass RLS.
-- Enabling RLS would break client-side reads without adding security.
-- This section cleans up any RLS state left by earlier migration attempts.

-- Drop all policies that may have been created by previous runs
DO $$ BEGIN
  -- shops
  DROP POLICY IF EXISTS shops_read_own      ON shops;
  DROP POLICY IF EXISTS shops_update_own    ON shops;
  DROP POLICY IF EXISTS shops_select        ON shops;
  DROP POLICY IF EXISTS shops_update        ON shops;
  -- team_members
  DROP POLICY IF EXISTS team_members_read_own    ON team_members;
  DROP POLICY IF EXISTS team_members_write_owner ON team_members;
  DROP POLICY IF EXISTS team_members_select      ON team_members;
  DROP POLICY IF EXISTS team_members_manage      ON team_members;
  -- customers
  DROP POLICY IF EXISTS customers_read_own   ON customers;
  DROP POLICY IF EXISTS customers_write_owner ON customers;
  DROP POLICY IF EXISTS customers_select     ON customers;
  DROP POLICY IF EXISTS customers_manage     ON customers;
  -- orders
  DROP POLICY IF EXISTS orders_read_own     ON orders;
  DROP POLICY IF EXISTS orders_write_owner  ON orders;
  DROP POLICY IF EXISTS orders_update_owner ON orders;
  DROP POLICY IF EXISTS orders_select       ON orders;
  DROP POLICY IF EXISTS orders_insert       ON orders;
  DROP POLICY IF EXISTS orders_update       ON orders;
  -- payments
  DROP POLICY IF EXISTS payments_read_own   ON payments;
  DROP POLICY IF EXISTS payments_write_owner ON payments;
  DROP POLICY IF EXISTS payments_select     ON payments;
  DROP POLICY IF EXISTS payments_manage     ON payments;
  -- measurements
  DROP POLICY IF EXISTS measurements_read_own   ON measurements;
  DROP POLICY IF EXISTS measurements_write_owner ON measurements;
  DROP POLICY IF EXISTS measurements_select     ON measurements;
  DROP POLICY IF EXISTS measurements_manage     ON measurements;
  -- order_photos
  DROP POLICY IF EXISTS order_photos_read_own  ON order_photos;
  DROP POLICY IF EXISTS order_photos_write_owner ON order_photos;
  DROP POLICY IF EXISTS order_photos_select    ON order_photos;
  DROP POLICY IF EXISTS order_photos_manage    ON order_photos;
  -- order_status_history
  DROP POLICY IF EXISTS order_status_history_read_own ON order_status_history;
  DROP POLICY IF EXISTS order_status_history_select   ON order_status_history;
  -- subscriptions
  DROP POLICY IF EXISTS subscriptions_read_own ON subscriptions;
  DROP POLICY IF EXISTS subscriptions_select   ON subscriptions;
  -- subscription_payments
  DROP POLICY IF EXISTS subscription_payments_select ON subscription_payments;
  -- shop_usage
  DROP POLICY IF EXISTS shop_usage_read_own ON shop_usage;
  DROP POLICY IF EXISTS shop_usage_select   ON shop_usage;
  -- push_subscriptions
  DROP POLICY IF EXISTS push_subscriptions_manage_own ON push_subscriptions;
  DROP POLICY IF EXISTS push_subscriptions_manage     ON push_subscriptions;
  -- email_verifications
  DROP POLICY IF EXISTS email_verifications_select ON email_verifications;
  DROP POLICY IF EXISTS email_verifications_manage ON email_verifications;
END $$;

-- Disable RLS on all tables that had it enabled from previous runs
ALTER TABLE shops                  DISABLE ROW LEVEL SECURITY;
ALTER TABLE team_members           DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers              DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments               DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_photos           DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history   DISABLE ROW LEVEL SECURITY;
ALTER TABLE measurements           DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE shop_usage             DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications    DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions     DISABLE ROW LEVEL SECURITY;

-- Drop the helper functions that are no longer needed
DROP FUNCTION IF EXISTS public.current_shop_id();
DROP FUNCTION IF EXISTS public.current_user_is_owner();
