-- 6.3: Drop duplicate/redundant indexes
-- Keeps one copy per logical index, drops overlaps

-- admin_audit_log: 3 copies of performed_at DESC → keep idx_admin_audit_log_performed
DROP INDEX IF EXISTS public.idx_admin_audit_log_performed_at;
DROP INDEX IF EXISTS public.idx_audit_log_date;
DROP INDEX IF EXISTS public.idx_audit_performed_at;

-- admin_audit_log: 2 copies of action → keep idx_admin_audit_log_action
DROP INDEX IF EXISTS public.idx_audit_action;

-- admin_audit_log: 2 copies of shop_id → keep idx_admin_audit_log_shop
DROP INDEX IF EXISTS public.idx_audit_shop_id;

-- admin_notifications: 2 copies of expires_at → keep admin_notifications_expires_at_idx
DROP INDEX IF EXISTS public.idx_admin_notifications_expires;

-- customers: 3 copies of (shop_id, last_order_at DESC) → keep idx_customers_last_order
DROP INDEX IF EXISTS public.idx_customers_last_order_at;
DROP INDEX IF EXISTS public.idx_customers_shop_last_order;

-- customers: 3 copies of shop_id → keep customers_shop_id_idx
DROP INDEX IF EXISTS public.idx_customers_shop;
DROP INDEX IF EXISTS public.idx_customers_shop_id;

-- customers: idx_customers_shop_id_phone covered by UNIQUE (shop_id, phone) constraint
DROP INDEX IF EXISTS public.idx_customers_shop_id_phone;

-- email_verifications: idx_email_verifications_phone covered by idx_email_verif_phone
DROP INDEX IF EXISTS public.idx_email_verifications_phone;

-- measurements: idx_measurements_customer_id covered by idx_measurements_customer
DROP INDEX IF EXISTS public.idx_measurements_customer_id;

-- measurements: idx_measurements_customer_recipient_garment is prefix of idx_measurements_customer_recipient
DROP INDEX IF EXISTS public.idx_measurements_customer_recipient_garment;

-- order_photos: idx_order_photos_order_id covered by idx_order_photos_order
DROP INDEX IF EXISTS public.idx_order_photos_order_id;

-- order_status_history: 2 copies of order_id → keep idx_order_status_history_order
DROP INDEX IF EXISTS public.idx_order_status_history_order_id;

-- orders: 3 copies of (shop_id, created_at DESC) → keep idx_orders_shop_created_at
DROP INDEX IF EXISTS public.idx_orders_created_at;
DROP INDEX IF EXISTS public.idx_orders_shop_created;

-- orders: idx_orders_shop_customer_id covered by idx_orders_customer
DROP INDEX IF EXISTS public.idx_orders_shop_customer_id;

-- orders: idx_orders_customer_id covered by orders_customer_id_idx
DROP INDEX IF EXISTS public.idx_orders_customer_id;

-- orders: idx_orders_shop_active covered by idx_orders_status
DROP INDEX IF EXISTS public.idx_orders_shop_active;

-- orders: orders_shop_id_status_idx covered by idx_orders_status
DROP INDEX IF EXISTS public.orders_shop_id_status_idx;

-- orders: idx_orders_due_date covered by idx_orders_shop_due_date
DROP INDEX IF EXISTS public.idx_orders_due_date;

-- orders: orders_shop_id_due_date_idx covered by idx_orders_shop_due_date
DROP INDEX IF EXISTS public.orders_shop_id_due_date_idx;

-- orders: idx_orders_shop_order_number covered by UNIQUE (shop_id, order_number)
DROP INDEX IF EXISTS public.idx_orders_shop_order_number;
DROP INDEX IF EXISTS public.idx_orders_order_number;

-- orders: tracking indexes covered by orders_tracking_code_unique
DROP INDEX IF EXISTS public.idx_orders_tracking;
DROP INDEX IF EXISTS public.idx_orders_tracking_code;

-- orders: idx_orders_assigned_to covered by idx_orders_assigned
DROP INDEX IF EXISTS public.idx_orders_assigned_to;

-- orders: idx_orders_shop_status covered by idx_orders_status
DROP INDEX IF EXISTS public.idx_orders_shop_status;

-- payments: idx_payments_order_id covered by idx_payments_order_active
DROP INDEX IF EXISTS public.idx_payments_order_id;
DROP INDEX IF EXISTS public.idx_payments_order;
DROP INDEX IF EXISTS public.payments_order_id_idx;

-- payments: idx_payments_shop_paid covered by idx_payments_shop_paid_at
DROP INDEX IF EXISTS public.idx_payments_shop_paid;

-- payments: idx_payments_paid_at covered by idx_payments_shop_paid_at
DROP INDEX IF EXISTS public.idx_payments_paid_at;

-- payments: idx_payments_shop_id covered by idx_payments_shop_paid_at
DROP INDEX IF EXISTS public.idx_payments_shop_id;

-- shop_verification_requests: shop indexes covered by UNIQUE shop_id
DROP INDEX IF EXISTS public.idx_shop_verif_requests_shop;
DROP INDEX IF EXISTS public.idx_shop_verif_shop;

-- shop_verification_requests: idx_shop_verif_requests_status covered by idx_shop_verif_status
DROP INDEX IF EXISTS public.idx_shop_verif_requests_status;

-- team_members: phone indexes → keep idx_team_members_phone_active
DROP INDEX IF EXISTS public.team_members_phone_idx;
DROP INDEX IF EXISTS public.idx_team_members_phone;
DROP INDEX IF EXISTS public.idx_team_phone;

-- shops: is_active duplicate
DROP INDEX IF EXISTS public.shops_is_active_idx;
