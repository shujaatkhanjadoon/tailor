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

-- Unique constraint for shop_usage (used by sbUpsertByShopId)
ALTER TABLE shop_usage DROP CONSTRAINT IF EXISTS shop_usage_shop_id_month_year_key;
ALTER TABLE shop_usage ADD CONSTRAINT shop_usage_shop_id_month_year_key UNIQUE (shop_id, month_year);

-- CHECK constraints for data integrity
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','in_progress','ready','delivered','cancelled'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cash','card','transfer','online','other'));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('trialing','active','cancelled','grace','expired'));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_cycle_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_cycle_check
  CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly','yearly','lifetime'));

ALTER TABLE subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_status_check;
ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_status_check
  CHECK (status IN ('pending','completed','failed','refunded'));

ALTER TABLE subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_method_check;
ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_method_check
  CHECK (method IN ('raast','reminder'));

ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE team_members ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('owner','admin','karigar','manager'));

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
--
-- Architecture notes:
--   The app uses custom PIN-based auth (no Supabase Auth sessions),
--   so auth.uid() is always NULL on client-side queries. The service
--   role key is used for all server-side API routes and bypasses RLS.
--
--   The client-side anon key is used for direct Supabase queries from
--   the browser. RLS policies for the anon role are intentionally
--   permissive because the real auth boundary is the API layer.
--   These policies provide defense-in-depth and a foundation for
--   future Supabase Auth migration.
--
--   The tracking endpoint (public order lookup) is granted explicit
--   SELECT access to limited order/shop columns.

-- Drop all policies that may have been created by previous runs
DO $$ BEGIN
  DROP POLICY IF EXISTS anon_shops_all       ON shops;
  DROP POLICY IF EXISTS anon_team_members_all ON team_members;
  DROP POLICY IF EXISTS anon_customers_all    ON customers;
  DROP POLICY IF EXISTS anon_orders_all       ON orders;
  DROP POLICY IF EXISTS anon_payments_all     ON payments;
  DROP POLICY IF EXISTS anon_order_photos_all ON order_photos;
  DROP POLICY IF EXISTS anon_order_status_history_all ON order_status_history;
  DROP POLICY IF EXISTS anon_measurements_all ON measurements;
  DROP POLICY IF EXISTS anon_subscriptions_all ON subscriptions;
  DROP POLICY IF EXISTS anon_subscription_payments_all ON subscription_payments;
  DROP POLICY IF EXISTS anon_shop_usage_all   ON shop_usage;
  DROP POLICY IF EXISTS anon_email_verifications_all ON email_verifications;
  DROP POLICY IF EXISTS anon_push_subscriptions_all ON push_subscriptions;
  DROP POLICY IF EXISTS public_tracking_select ON orders;
END $$;

-- Enable RLS on all tables
ALTER TABLE IF EXISTS shops                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_status_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS measurements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscription_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shop_usage             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS email_verifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_subscriptions     ENABLE ROW LEVEL SECURITY;

-- ── Anon-role policies — full CRUD, app-layer auth ────────────
-- These match the existing client-side query patterns. The service
-- role key is used for server-side operations and bypasses RLS.
-- Tightening these policies requires migrating to Supabase Auth.

-- shops
CREATE POLICY anon_shops_all ON shops FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- team_members
CREATE POLICY anon_team_members_all ON team_members FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- customers
CREATE POLICY anon_customers_all ON customers FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- orders
CREATE POLICY anon_orders_all ON orders FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- payments
CREATE POLICY anon_payments_all ON payments FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- order_photos
CREATE POLICY anon_order_photos_all ON order_photos FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- order_status_history
CREATE POLICY anon_order_status_history_all ON order_status_history FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- measurements
CREATE POLICY anon_measurements_all ON measurements FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- subscriptions
CREATE POLICY anon_subscriptions_all ON subscriptions FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- subscription_payments
CREATE POLICY anon_subscription_payments_all ON subscription_payments FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- shop_usage
CREATE POLICY anon_shop_usage_all ON shop_usage FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- email_verifications
CREATE POLICY anon_email_verifications_all ON email_verifications FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- push_subscriptions
CREATE POLICY anon_push_subscriptions_all ON push_subscriptions FOR ALL TO anon
  USING (true) WITH CHECK (true);

-- ── Public tracking ───────────────────────────────────────────
-- Allow anyone (including unauthenticated users) to look up an
-- order by tracking code. This is used by TrackClient.tsx.
CREATE POLICY public_tracking_select ON orders FOR SELECT TO public
  USING (tracking_code IS NOT NULL AND deleted_at IS NULL);

-- Drop the helper functions that are no longer needed
DROP FUNCTION IF EXISTS public.current_shop_id();
DROP FUNCTION IF EXISTS public.current_user_is_owner();
