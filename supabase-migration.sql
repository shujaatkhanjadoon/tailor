



-- ============================================================
-- Tailor App — Supabase Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 0. Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 0a. CREATE TABLE IF NOT EXISTS (DDL for fresh environments)
-- ============================================================

CREATE TABLE IF NOT EXISTS shops (
  id              UUID PRIMARY KEY,
  shop_name       TEXT NOT NULL,
  owner_name      TEXT,
  owner_phone     TEXT,
  whatsapp_number TEXT,
  owner_email     TEXT,
  state_province  TEXT,
  city            TEXT,
  address_line    TEXT,
  postal_code     TEXT,
  brand_name      TEXT,
  brand_color     TEXT,
  brand_logo_url  TEXT,
  plan            TEXT NOT NULL DEFAULT 'starter',
  plan_expires_at TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  verification_status TEXT DEFAULT 'pending',
  encrypted_owner_pin TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS team_members (
  id              UUID PRIMARY KEY,
  shop_id         UUID NOT NULL REFERENCES shops(id),
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('owner', 'karigar')),
  pin_hash        TEXT NOT NULL,
  email           TEXT,
  email_verified  BOOLEAN DEFAULT false,
  speciality      TEXT,
  pay_rate_type   TEXT,
  pay_rate        NUMERIC,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  failed_attempts INTEGER DEFAULT 0,
  joined_at       DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY,
  shop_id         UUID NOT NULL REFERENCES shops(id),
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  whatsapp        TEXT,
  gender          TEXT,
  notes           TEXT,
  photo_url       TEXT,
  total_orders    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ,
  last_order_at   TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY,
  shop_id             UUID NOT NULL REFERENCES shops(id),
  order_number        INTEGER NOT NULL,
  tracking_code       TEXT,
  customer_id         UUID REFERENCES customers(id),
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT,
  order_for_relation  TEXT DEFAULT 'self',
  order_for_name      TEXT,
  recipient_gender    TEXT,
  measurement_id      UUID,
  garment_type        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'received',
  assigned_to         UUID REFERENCES team_members(id),
  assigned_to_name    TEXT,
  total_price         NUMERIC DEFAULT 0,
  amount_paid         NUMERIC DEFAULT 0,
  is_urgent           BOOLEAN DEFAULT false,
  due_date            DATE,
  special_instructions TEXT,
  fabric_photo_url    TEXT,
  style_photo_url     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY,
  shop_id           UUID NOT NULL REFERENCES shops(id),
  order_id          UUID REFERENCES orders(id),
  amount            NUMERIC NOT NULL DEFAULT 0,
  applied_to_balance NUMERIC,
  kind              TEXT DEFAULT 'order_payment',
  method            TEXT,
  recorded_by       UUID REFERENCES team_members(id),
  paid_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes             TEXT,
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS measurements (
  id                  UUID PRIMARY KEY,
  customer_id         UUID NOT NULL REFERENCES customers(id),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  order_for_relation  TEXT DEFAULT 'self',
  order_for_name      TEXT,
  recipient_gender    TEXT,
  garment_type        TEXT,
  values              JSONB DEFAULT '{}',
  notes               TEXT,
  taken_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_photos (
  id              UUID PRIMARY KEY,
  order_id        UUID NOT NULL REFERENCES orders(id),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  type            TEXT,
  base64          TEXT,
  cloud_url       TEXT,
  public_id       TEXT,
  cloud_size_kb   NUMERIC,
  size_kb         NUMERIC,
  taken_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id          UUID PRIMARY KEY,
  order_id    UUID NOT NULL REFERENCES orders(id),
  shop_id     UUID NOT NULL REFERENCES shops(id),
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL UNIQUE REFERENCES shops(id),
  plan            TEXT NOT NULL DEFAULT 'starter',
  status          TEXT NOT NULL DEFAULT 'active',
  trial_ends_at   TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  billing_cycle   TEXT,
  amount_pkr      NUMERIC,
  gateway         TEXT,
  gateway_sub_id  TEXT,
  cancelled_at    TIMESTAMPTZ,
  grace_ends_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  subscription_id UUID REFERENCES subscriptions(id),
  plan            TEXT,
  billing_cycle   TEXT,
  amount_pkr      NUMERIC,
  method          TEXT,
  gateway_tx_id   TEXT,
  status          TEXT DEFAULT 'pending',
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_data    JSONB,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL UNIQUE REFERENCES shops(id),
  orders_this_month   INTEGER DEFAULT 0,
  customers_total     INTEGER DEFAULT 0,
  karigar_count       INTEGER DEFAULT 0,
  storage_used_kb     NUMERIC DEFAULT 0,
  month_year          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (phone, email)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     UUID NOT NULL REFERENCES shops(id),
  member_id   UUID REFERENCES team_members(id),
  endpoint    TEXT NOT NULL,
  keys        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  type          TEXT DEFAULT 'info',
  target_plan   TEXT DEFAULT 'all',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  created_by    TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           TEXT NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  success         BOOLEAN NOT NULL,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        TEXT NOT NULL,
  target_type   TEXT NOT NULL,
  target_id     TEXT NOT NULL,
  shop_id       UUID REFERENCES shops(id),
  details       JSONB DEFAULT '{}',
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shop_verification_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id),
  owner_name    TEXT,
  owner_phone   TEXT,
  owner_email   TEXT,
  state_province TEXT,
  city          TEXT,
  status        TEXT DEFAULT 'pending',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cron_cursors (
  job_name      TEXT PRIMARY KEY,
  cursor_value  TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  subject     TEXT DEFAULT '',
  body        TEXT NOT NULL,
  variables   TEXT[] DEFAULT ARRAY[]::TEXT[],
  channel     TEXT DEFAULT 'whatsapp',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add missing columns to existing shops (safe to re-run)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE shops ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

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

-- login_attempts: lookup
CREATE INDEX IF NOT EXISTS idx_login_attempts_phone ON login_attempts (phone);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts (created_at DESC);

-- admin_audit_log: lookup
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_performed_at ON admin_audit_log (performed_at DESC);

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

-- Add token_version for session revocation support
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;

-- Prevent duplicate order numbers within a shop (race condition fix)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_shop_id_order_number_key;
ALTER TABLE orders ADD CONSTRAINT orders_shop_id_order_number_key UNIQUE (shop_id, order_number);

-- Prevent duplicate transaction IDs in subscription payments
ALTER TABLE subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_gateway_tx_id_key;
ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_gateway_tx_id_key UNIQUE (gateway_tx_id);

-- ============================================================
-- 3. CHECK CONSTRAINTS
-- ============================================================

-- Fix orders.status check constraint to match app code values
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('received', 'cutting', 'stitching', 'finishing', 'ready', 'delivered', 'cancelled'));

-- ============================================================
-- 4. ROW LEVEL SECURITY — ENABLED WITH SHOP-ID-BASED POLICIES
-- ============================================================
--
-- Architecture note:
--   The app uses custom PIN-based auth (no Supabase Auth sessions),
--   so auth.uid() is always NULL on client-side anon-key queries.
--   All writes go through service-role API routes which bypass RLS.
--   Reads are done client-side with the anon key.
--
--   RLS uses a custom session variable set by the proxy middleware.
--   The proxy sets request.jwt.claims (via Supabase pgJWT) OR we
--   use the shop_id embedded in a Supabase-signed JWT. Since we
--   cannot rely on auth.uid(), we instead rely on an application-
--   managed session flow where the proxy is the gatekeeper.
--
--   Because the anon key is public, RLS policies restrict reads to:
--     • Rows belonging to the shop_id stored in the member's session
--     • Only non-deleted rows
--   The proxy middleware sets `app.current_shop_id` via a custom
--   claim before forwarding requests to Supabase.
--
--   For the admin panel and cron jobs, the service role key is used
--   server-side and bypasses RLS entirely.
-- ============================================================

-- Helper: get the current shop_id from the session (set by proxy)
CREATE OR REPLACE FUNCTION public.current_shop_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$ SELECT nullif(current_setting('app.current_shop_id', true), '')::UUID $$;

-- Drop all old policies first
DO $$ BEGIN
  DROP POLICY IF EXISTS shops_select             ON shops;
  DROP POLICY IF EXISTS team_members_select       ON team_members;
  DROP POLICY IF EXISTS customers_select         ON customers;
  DROP POLICY IF EXISTS orders_select            ON orders;
  DROP POLICY IF EXISTS payments_select          ON payments;
  DROP POLICY IF EXISTS order_photos_select      ON order_photos;
  DROP POLICY IF EXISTS order_status_history_select ON order_status_history;
  DROP POLICY IF EXISTS measurements_select      ON measurements;
  DROP POLICY IF EXISTS subscriptions_select     ON subscriptions;
  DROP POLICY IF EXISTS subscription_payments_select ON subscription_payments;
  DROP POLICY IF EXISTS shop_usage_select        ON shop_usage;
  DROP POLICY IF EXISTS email_verifications_select ON email_verifications;
  DROP POLICY IF EXISTS push_subscriptions_select ON push_subscriptions;
END $$;

-- Enable RLS on all tables
ALTER TABLE shops                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_photos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_usage             ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions     ENABLE ROW LEVEL SECURITY;

-- Policies: SELECT only rows belonging to the current shop
CREATE POLICY shops_select ON shops
  FOR SELECT USING (id = current_shop_id());

CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (shop_id = current_shop_id() AND deleted_at IS NULL);

CREATE POLICY customers_select ON customers
  FOR SELECT USING (shop_id = current_shop_id() AND deleted_at IS NULL);

CREATE POLICY orders_select ON orders
  FOR SELECT USING (shop_id = current_shop_id() AND deleted_at IS NULL);

CREATE POLICY payments_select ON payments
  FOR SELECT USING (shop_id = current_shop_id() AND deleted_at IS NULL);

CREATE POLICY order_photos_select ON order_photos
  FOR SELECT USING (shop_id = current_shop_id() AND deleted_at IS NULL);

CREATE POLICY order_status_history_select ON order_status_history
  FOR SELECT USING (shop_id = current_shop_id());

CREATE POLICY measurements_select ON measurements
  FOR SELECT USING (
    customer_id IN (
      SELECT id FROM customers WHERE shop_id = current_shop_id() AND deleted_at IS NULL
    )
  );

CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (shop_id = current_shop_id());

CREATE POLICY subscription_payments_select ON subscription_payments
  FOR SELECT USING (shop_id = current_shop_id());

CREATE POLICY shop_usage_select ON shop_usage
  FOR SELECT USING (shop_id = current_shop_id());

CREATE POLICY email_verifications_select ON email_verifications
  FOR SELECT USING (phone IN (
    SELECT phone FROM team_members WHERE shop_id = current_shop_id() AND deleted_at IS NULL
  ));

CREATE POLICY push_subscriptions_select ON push_subscriptions
  FOR SELECT USING (shop_id = current_shop_id());

-- ============================================================
-- 5. DATABASE FUNCTIONS
-- ============================================================

-- Atomic coupon used_count increment (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_coupon_used_count(p_coupon_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id
    AND (max_uses IS NULL OR used_count < max_uses)
    AND is_active = true
  RETURNING used_count INTO updated_count;

  RETURN FOUND;
END;
$$;

-- ============================================================
-- 6. SHOP USAGE COUNTER TRIGGERS
-- ============================================================
-- Automatically maintain shop_usage counters when orders,
-- customers, or team members are inserted / updated / deleted.
-- Uses upsert so a row is created on first write for every shop.

-- Ensure id column exists (may be missing on tables that predate this DDL)
ALTER TABLE shop_usage ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION upsert_shop_usage(
  p_shop_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO shop_usage (shop_id, orders_this_month, customers_total, karigar_count, storage_used_kb, month_year, updated_at)
  VALUES (p_shop_id, 0, 0, 0, 0, to_char(now(), 'YYYY-MM'), now())
  ON CONFLICT (shop_id) DO NOTHING;
END;
$$;

-- Recalculate orders_this_month from live data
CREATE OR REPLACE FUNCTION recalc_orders_this_month(p_shop_id UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*)::integer INTO cnt
  FROM orders
  WHERE shop_id = p_shop_id
    AND deleted_at IS NULL
    AND created_at >= date_trunc('month', now());
  RETURN cnt;
END;
$$;

-- Recalculate customers_total from live data
CREATE OR REPLACE FUNCTION recalc_customers_total(p_shop_id UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*)::integer INTO cnt
  FROM customers
  WHERE shop_id = p_shop_id
    AND deleted_at IS NULL;
  RETURN cnt;
END;
$$;

-- Recalculate karigar_count from live data
CREATE OR REPLACE FUNCTION recalc_karigar_count(p_shop_id UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*)::integer INTO cnt
  FROM team_members
  WHERE shop_id = p_shop_id
    AND role = 'karigar'
    AND is_active = true
    AND deleted_at IS NULL;
  RETURN cnt;
END;
$$;

-- Refresh all counters for a shop
CREATE OR REPLACE FUNCTION refresh_shop_usage(p_shop_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM upsert_shop_usage(p_shop_id);
  UPDATE shop_usage
  SET orders_this_month = recalc_orders_this_month(p_shop_id),
      customers_total   = recalc_customers_total(p_shop_id),
      karigar_count     = recalc_karigar_count(p_shop_id),
      month_year        = to_char(now(), 'YYYY-MM'),
      updated_at        = now()
  WHERE shop_id = p_shop_id;
END;
$$;

-- Trigger: refresh shop_usage when orders change
CREATE OR REPLACE FUNCTION trg_orders_refresh_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM refresh_shop_usage(OLD.shop_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS orders_usage_trigger ON orders;
CREATE TRIGGER orders_usage_trigger
  AFTER INSERT OR UPDATE OF deleted_at, created_at OR DELETE
  ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trg_orders_refresh_usage();

-- Trigger: refresh shop_usage when customers change
CREATE OR REPLACE FUNCTION trg_customers_refresh_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM refresh_shop_usage(OLD.shop_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS customers_usage_trigger ON customers;
CREATE TRIGGER customers_usage_trigger
  AFTER INSERT OR UPDATE OF deleted_at OR DELETE
  ON customers
  FOR EACH ROW
  EXECUTE FUNCTION trg_customers_refresh_usage();

-- Trigger: refresh shop_usage when team members change
CREATE OR REPLACE FUNCTION trg_team_refresh_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM refresh_shop_usage(OLD.shop_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS team_usage_trigger ON team_members;
CREATE TRIGGER team_usage_trigger
  AFTER INSERT OR UPDATE OF is_active, deleted_at OR DELETE
  ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION trg_team_refresh_usage();

-- ============================================================
-- 7. DEFAULT MESSAGE TEMPLATES (seed data)
-- ============================================================

INSERT INTO message_templates (id, key, label, subject, body, variables, channel, updated_at) VALUES
  (gen_random_uuid(), 'activation', 'Activation Message', 'Aapki shop activate ho gayi hai!', 'Assalam o Alaikum {owner_name}! Aapki MeraDarzi shop ({shop_name}) activate ho gayi hai. Ab aap login karke orders lena shuru kar sakte hain.\n\nShukriya!\nMeraDarzi Team', ARRAY['owner_name', 'shop_name'], 'whatsapp', now()),
  (gen_random_uuid(), 'rejection', 'Rejection Message', 'Shop verification rejected', 'Assalam o Alaikum {owner_name}! Aapki MeraDarzi shop ({shop_name}) ki verification reject kar di gayi hai.\n\nWajah: {reason}\n\nBaraye meharbani humse rabta karein.\nShukriya!', ARRAY['owner_name', 'shop_name', 'reason'], 'whatsapp', now()),
  (gen_random_uuid(), 'reminder_5d', '5-Day Reminder', 'Subscription 5 din mein expire ho rahi hai', 'Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription {days_left} din mein expire ho rahi hai.\n\nExpiry Date: {expiry_date}\nPlan: {plan}\n\nRenewal karein: {renewal_url}\n\nShukriya!', ARRAY['owner_name', 'shop_name', 'days_left', 'expiry_date', 'plan', 'renewal_url'], 'whatsapp', now()),
  (gen_random_uuid(), 'reminder_3d', '3-Day Reminder', 'Subscription 3 din mein expire ho rahi hai', 'Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription sirf {days_left} din mein expire ho rahi hai.\n\nExpiry Date: {expiry_date}\nPlan: {plan}\n\nAbhi renewal karein: {renewal_url}\n\nShukriya!', ARRAY['owner_name', 'shop_name', 'days_left', 'expiry_date', 'plan', 'renewal_url'], 'whatsapp', now()),
  (gen_random_uuid(), 'reminder_1d', '1-Day Reminder', 'Subscription kal expire ho rahi hai!', 'Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription KAL expire ho rahi hai.\n\nExpiry Date: {expiry_date}\nPlan: {plan}\n\nFauran renewal karein: {renewal_url}\n\nAgar renewal nahi kiya to service band ho jayegi.\nShukriya!', ARRAY['owner_name', 'shop_name', 'days_left', 'expiry_date', 'plan', 'renewal_url'], 'whatsapp', now()),
  (gen_random_uuid(), 'expiry_notification', 'Expiry Notification', 'Aapki subscription expire ho gayi hai', 'Assalam o Alaikum {owner_name}! Aapki MeraDarzi subscription expire ho gayi hai. Ab aap limited features use kar sakte hain.\n\nApni service dubara active karne ke liye renewal karein:\n{renewal_url}\n\nShukriya!', ARRAY['owner_name', 'shop_name', 'renewal_url'], 'whatsapp', now())
ON CONFLICT (key) DO NOTHING;

