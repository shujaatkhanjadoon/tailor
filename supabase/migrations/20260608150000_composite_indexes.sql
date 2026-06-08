-- Composite indexes for common query patterns

CREATE INDEX IF NOT EXISTS idx_team_members_shop_phone ON team_members(shop_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_members_shop_role   ON team_members(shop_id, role)   WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_shop_phone    ON customers(shop_id, phone)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_shop_name     ON customers(shop_id, name)   WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_orders_shop_status      ON orders(shop_id, status)       WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_shop_created     ON orders(shop_id, created_at)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer         ON orders(customer_id, shop_id)  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_measurements_customer   ON measurements(customer_id, shop_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_shop_order     ON payments(shop_id, order_id)   WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payments_shop_paid_at   ON payments(shop_id, paid_at)    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_history_order     ON order_status_history(order_id, changed_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_shop      ON subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan      ON subscriptions(plan) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_shop_usage_shop_month   ON shop_usage(shop_id, month_year);

CREATE INDEX IF NOT EXISTS idx_login_attempts_phone    ON login_attempts(phone, created_at DESC);
