-- Database constraints and fixes from audit report

-- 3.5: UNIQUE constraint on gateway_tx_id for dedup
ALTER TABLE subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_gateway_tx_id_key;
ALTER TABLE subscription_payments ADD CONSTRAINT subscription_payments_gateway_tx_id_key UNIQUE (gateway_tx_id);

-- 3.5: Foreign keys for coupon_redemptions
ALTER TABLE coupon_redemptions DROP CONSTRAINT IF EXISTS coupon_redemptions_coupon_id_fkey;
ALTER TABLE coupon_redemptions ADD CONSTRAINT coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE;
ALTER TABLE coupon_redemptions DROP CONSTRAINT IF EXISTS coupon_redemptions_shop_id_fkey;
ALTER TABLE coupon_redemptions ADD CONSTRAINT coupon_redemptions_shop_id_fkey FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE;
ALTER TABLE coupon_redemptions DROP CONSTRAINT IF EXISTS coupon_redemptions_subscription_payment_id_fkey;
ALTER TABLE coupon_redemptions ADD CONSTRAINT coupon_redemptions_subscription_payment_id_fkey FOREIGN KEY (subscription_payment_id) REFERENCES subscription_payments(id) ON DELETE SET NULL;

-- 3.4: CHECK constraint to prevent coupon overuse (atomic safety net)
ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_used_count_max_uses_check;
ALTER TABLE coupons ADD CONSTRAINT coupons_used_count_max_uses_check CHECK (used_count <= max_uses);

-- 3.4: RPC function for atomic coupon increment
CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_uses integer;
  v_used_count integer;
BEGIN
  SELECT max_uses, used_count INTO v_max_uses, v_used_count
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_used_count >= v_max_uses THEN
    RETURN false;
  END IF;

  UPDATE public.coupons
  SET used_count = used_count + 1, updated_at = now()
  WHERE id = p_coupon_id;

  RETURN true;
END;
$$;

-- 1.1: Cron cursor tracking table for incremental cron processing
CREATE TABLE IF NOT EXISTS public.cron_cursors (
  job_name text PRIMARY KEY,
  cursor_value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cron_cursors ENABLE ROW LEVEL SECURITY;

-- Index for cleanup-photos cursor
CREATE INDEX IF NOT EXISTS idx_order_photos_taken_at_id ON public.order_photos (taken_at, id);
