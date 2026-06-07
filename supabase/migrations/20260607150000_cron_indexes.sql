-- Performance indexes for cron job queries
-- These eliminate full sequential scans on frequently-queried columns

-- expire-subscriptions: grace period expiry lookup
create index if not exists idx_sub_status_grace_ends_at
  on "public"."subscriptions" ("status", "grace_ends_at")
  where "grace_ends_at" is not null;

-- expire-subscriptions: stale pending payments
create index if not exists idx_sub_payments_status_paid_at
  on "public"."subscription_payments" ("status", "paid_at");

-- send-reminders: dedup check (shop_id + gateway_tx_id + status)
create index if not exists idx_sub_payments_reminder_dedup
  on "public"."subscription_payments" ("shop_id", "gateway_tx_id", "status");

-- cleanup-photos: old photo scan
create index if not exists idx_order_photos_taken_at
  on "public"."order_photos" ("taken_at")
  where "deleted_at" is null;
