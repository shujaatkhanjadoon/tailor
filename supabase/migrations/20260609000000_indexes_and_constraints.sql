-- Missing indexes and constraints from audit report

-- Unique partial index on (shop_id, order_number) for non-deleted orders
-- This prevents race-condition duplicate order numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_shop_order_number_unique
ON public.orders (shop_id, order_number)
WHERE deleted_at IS NULL;

-- Missing index: orders filtered by assigned_to (karigar view)
CREATE INDEX IF NOT EXISTS idx_orders_shop_assigned_to
ON public.orders (shop_id, assigned_to)
WHERE deleted_at IS NULL;

-- Missing index: subscription payment history by subscription
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription_id
ON public.subscription_payments (subscription_id);

-- Index for payment status filtering (admin pending payments dashboard)
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status
ON public.subscription_payments (status)
WHERE status = 'pending';
