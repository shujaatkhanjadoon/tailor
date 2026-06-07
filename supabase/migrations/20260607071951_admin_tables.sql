-- Admin tables migration: missing tables for admin dashboard features

-- ── Cron job execution log ────────────────────────────────────────
create table "public"."cron_log" (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "status" text not null default 'running'::text,
  "started_at" timestamp with time zone not null default now(),
  "finished_at" timestamp with time zone,
  "error" text,
  "duration_ms" numeric
);

alter table "public"."cron_log" enable row level security;

-- ── Coupon codes ──────────────────────────────────────────────────
create table "public"."coupons" (
  "id" uuid not null default gen_random_uuid(),
  "code" text not null,
  "discount_pct" numeric not null,
  "max_uses" integer not null default 100,
  "used_count" integer not null default 0,
  "max_uses_per_shop" integer not null default 1,
  "min_amount_pkr" numeric,
  "applies_to_plan" text,
  "expires_at" timestamp with time zone not null,
  "is_active" boolean not null default true,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone default now()
);

alter table "public"."coupons" enable row level security;

create unique index if not exists coupons_code_key on "public"."coupons" ("code");

-- ── Coupon redemption tracking ────────────────────────────────────
create table "public"."coupon_redemptions" (
  "id" uuid not null default gen_random_uuid(),
  "coupon_id" uuid not null,
  "shop_id" uuid not null,
  "subscription_payment_id" uuid,
  "discount_pct" numeric not null,
  "original_amount" numeric not null,
  "discounted_amount" numeric not null,
  "redeemed_at" timestamp with time zone not null default now()
);

alter table "public"."coupon_redemptions" enable row level security;

-- ── Message templates for WhatsApp / email / push ─────────────────
create table "public"."message_templates" (
  "id" uuid not null default gen_random_uuid(),
  "key" text not null,
  "label" text not null,
  "subject" text not null default ''::text,
  "body" text not null,
  "variables" jsonb not null default '[]'::jsonb,
  "channel" text not null default 'email'::text,
  "updated_at" timestamp with time zone not null default now()
);

alter table "public"."message_templates" enable row level security;

create unique index if not exists message_templates_key_key on "public"."message_templates" ("key");

-- ── Sub-admin accounts ────────────────────────────────────────────
create table "public"."admin_accounts" (
  "id" uuid not null default gen_random_uuid(),
  "username" text not null,
  "secret_hash" text not null,
  "totp_secret" text,
  "role" text not null default 'support'::text,
  "is_active" boolean not null default true,
  "last_login" timestamp with time zone,
  "created_at" timestamp with time zone not null default now(),
  "created_by" text
);

alter table "public"."admin_accounts" enable row level security;

create unique index if not exists admin_accounts_username_key on "public"."admin_accounts" ("username");

-- ── IP blocklist ──────────────────────────────────────────────────
create table "public"."ip_blocklist" (
  "id" uuid not null default gen_random_uuid(),
  "ip" text not null,
  "reason" text default 'Blocked by admin'::text,
  "blocked_by" text,
  "blocked_at" timestamp with time zone not null default now(),
  "expires_at" timestamp with time zone,
  "is_active" boolean not null default true
);

alter table "public"."ip_blocklist" enable row level security;

create index if not exists ip_blocklist_ip_idx on "public"."ip_blocklist" ("ip");
