-- Add primary keys to tables that were created without them

alter table "public"."cron_log" add primary key ("id");
alter table "public"."coupons" add primary key ("id");
alter table "public"."coupon_redemptions" add primary key ("id");
alter table "public"."message_templates" add primary key ("id");
alter table "public"."admin_accounts" add primary key ("id");
alter table "public"."ip_blocklist" add primary key ("id");
