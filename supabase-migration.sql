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
-- 3. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper: shop_id from team_members via anon JWT (assuming user_id = member id)
-- These policies use the anon key; service_role bypasses RLS entirely.

-- shops: owner can read own shop, team members can read their shop
DROP POLICY IF EXISTS shops_read_own ON shops;
CREATE POLICY shops_read_own ON shops
  FOR SELECT USING (
    id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- shops: only authenticated owner can update
DROP POLICY IF EXISTS shops_update_own ON shops;
CREATE POLICY shops_update_own ON shops
  FOR UPDATE USING (
    id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND role = 'owner' AND deleted_at IS NULL)
  );

-- team_members: members can read their own team
DROP POLICY IF EXISTS team_members_read_own ON team_members;
CREATE POLICY team_members_read_own ON team_members
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- team_members: owner can manage team
DROP POLICY IF EXISTS team_members_write_owner ON team_members;
CREATE POLICY team_members_write_owner ON team_members
  FOR ALL USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND role = 'owner' AND deleted_at IS NULL)
  );

-- customers: members can read customers in their shop
DROP POLICY IF EXISTS customers_read_own ON customers;
CREATE POLICY customers_read_own ON customers
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- customers: owner can write
DROP POLICY IF EXISTS customers_write_owner ON customers;
CREATE POLICY customers_write_owner ON customers
  FOR ALL USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND role = 'owner' AND deleted_at IS NULL)
  );

-- orders: members can read orders in their shop
DROP POLICY IF EXISTS orders_read_own ON orders;
CREATE POLICY orders_read_own ON orders
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- orders: owner can write (karigar can update status via the app using service role)
DROP POLICY IF EXISTS orders_write_owner ON orders;
CREATE POLICY orders_write_owner ON orders
  FOR INSERT WITH CHECK (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND role = 'owner' AND deleted_at IS NULL)
  );
DROP POLICY IF EXISTS orders_update_owner ON orders;
CREATE POLICY orders_update_owner ON orders
  FOR UPDATE USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND role = 'owner' AND deleted_at IS NULL)
  );

-- payments: members can read payments in their shop
DROP POLICY IF EXISTS payments_read_own ON payments;
CREATE POLICY payments_read_own ON payments
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- payments: owner can write
DROP POLICY IF EXISTS payments_write_owner ON payments;
CREATE POLICY payments_write_owner ON payments
  FOR ALL USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND role = 'owner' AND deleted_at IS NULL)
  );

-- measurements: members can read measurements in their shop
DROP POLICY IF EXISTS measurements_read_own ON measurements;
CREATE POLICY measurements_read_own ON measurements
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- measurements: owner can write
DROP POLICY IF EXISTS measurements_write_owner ON measurements;
CREATE POLICY measurements_write_owner ON measurements
  FOR ALL USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND role = 'owner' AND deleted_at IS NULL)
  );

-- order_photos: members can read photos in their shop
DROP POLICY IF EXISTS order_photos_read_own ON order_photos;
CREATE POLICY order_photos_read_own ON order_photos
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- order_status_history: members can read history in their shop
DROP POLICY IF EXISTS order_status_history_read_own ON order_status_history;
CREATE POLICY order_status_history_read_own ON order_status_history
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- subscriptions: members can read subscription
DROP POLICY IF EXISTS subscriptions_read_own ON subscriptions;
CREATE POLICY subscriptions_read_own ON subscriptions
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- shop_usage: members can read usage
DROP POLICY IF EXISTS shop_usage_read_own ON shop_usage;
CREATE POLICY shop_usage_read_own ON shop_usage
  FOR SELECT USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );

-- push_subscriptions: member can manage own
DROP POLICY IF EXISTS push_subscriptions_manage_own ON push_subscriptions;
CREATE POLICY push_subscriptions_manage_own ON push_subscriptions
  FOR ALL USING (
    shop_id IN (SELECT shop_id FROM team_members WHERE id = auth.uid() AND deleted_at IS NULL)
  );
