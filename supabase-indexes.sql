-- Performance: composite indexes for reports/analytics queries
CREATE INDEX IF NOT EXISTS idx_orders_shop_id_created_at_status ON orders (shop_id, created_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id_garment_type ON orders (shop_id, garment_type);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id_customer ON orders (shop_id, customer_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id_paid_at_method ON payments (shop_id, paid_at DESC, method);

-- Performance: subscription status lookups (cron jobs, admin panels)
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_expires ON subscriptions (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id_status ON subscriptions (shop_id, status);

-- Performance: subscription payments lookups
CREATE INDEX IF NOT EXISTS idx_sub_payments_shop_id_status ON subscription_payments (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status_paid_at ON subscription_payments (status, paid_at);
