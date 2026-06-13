-- Speed up admin payments page queries (was doing full table scans)
-- Queries: status=pending + method!=reminder + order by paid_at desc
-- Queries: status=all + method!=reminder + order by paid_at desc

CREATE INDEX IF NOT EXISTS idx_sub_payments_status_paid_at
  ON subscription_payments (status, paid_at DESC);

CREATE INDEX IF NOT EXISTS idx_sub_payments_method
  ON subscription_payments (method);
