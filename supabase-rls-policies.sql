-- ============================================================
-- INSERT / UPDATE / DELETE RLS POLICIES (for client-side anon key writes)
-- Uses DO blocks for safe re-execution regardless of PostgreSQL version
-- ============================================================

-- Customers
DO $$ BEGIN
  DROP POLICY IF EXISTS customers_insert ON customers;
  CREATE POLICY customers_insert ON customers FOR INSERT WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS customers_update ON customers;
  CREATE POLICY customers_update ON customers FOR UPDATE USING (shop_id = current_shop_id()) WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS customers_delete ON customers;
  CREATE POLICY customers_delete ON customers FOR DELETE USING (shop_id = current_shop_id());
END $$;

-- Orders
DO $$ BEGIN
  DROP POLICY IF EXISTS orders_insert ON orders;
  CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS orders_update ON orders;
  CREATE POLICY orders_update ON orders FOR UPDATE USING (shop_id = current_shop_id()) WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS orders_delete ON orders;
  CREATE POLICY orders_delete ON orders FOR DELETE USING (shop_id = current_shop_id());
END $$;

-- Payments
DO $$ BEGIN
  DROP POLICY IF EXISTS payments_insert ON payments;
  CREATE POLICY payments_insert ON payments FOR INSERT WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS payments_update ON payments;
  CREATE POLICY payments_update ON payments FOR UPDATE USING (shop_id = current_shop_id()) WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS payments_delete ON payments;
  CREATE POLICY payments_delete ON payments FOR DELETE USING (shop_id = current_shop_id());
END $$;

-- Measurements
DO $$ BEGIN
  DROP POLICY IF EXISTS measurements_insert ON measurements;
  CREATE POLICY measurements_insert ON measurements FOR INSERT WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS measurements_update ON measurements;
  CREATE POLICY measurements_update ON measurements FOR UPDATE USING (shop_id = current_shop_id()) WITH CHECK (shop_id = current_shop_id());
END $$;
DO $$ BEGIN
  DROP POLICY IF EXISTS measurements_delete ON measurements;
  CREATE POLICY measurements_delete ON measurements FOR DELETE USING (shop_id = current_shop_id());
END $$;

-- Order photos
DO $$ BEGIN
  DROP POLICY IF EXISTS order_photos_insert ON order_photos;
  CREATE POLICY order_photos_insert ON order_photos FOR INSERT WITH CHECK (shop_id = current_shop_id());
END $$;

-- Order status history
DO $$ BEGIN
  DROP POLICY IF EXISTS order_status_history_insert ON order_status_history;
  CREATE POLICY order_status_history_insert ON order_status_history FOR INSERT WITH CHECK (shop_id = current_shop_id());
END $$;

-- Team members
DO $$ BEGIN
  DROP POLICY IF EXISTS team_members_insert ON team_members;
  CREATE POLICY team_members_insert ON team_members FOR INSERT WITH CHECK (shop_id = current_shop_id());
END $$;
