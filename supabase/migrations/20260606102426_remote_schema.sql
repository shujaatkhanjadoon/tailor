drop extension if exists "pg_net";

create extension if not exists "pg_trgm" with schema "public";


  create table "public"."admin_audit_log" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "action" text not null,
    "target_type" text,
    "target_id" text,
    "shop_id" uuid,
    "details" jsonb default '{}'::jsonb,
    "performed_at" timestamp with time zone default now()
      );


alter table "public"."admin_audit_log" enable row level security;


  create table "public"."admin_notifications" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "message" text not null,
    "target_plan" text not null default 'all'::text,
    "created_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null,
    "type" text not null default 'info'::text
      );


alter table "public"."admin_notifications" enable row level security;


  create table "public"."customers" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "shop_id" uuid not null,
    "name" text not null,
    "phone" text not null,
    "whatsapp" text,
    "gender" text not null,
    "notes" text,
    "photo_url" text,
    "total_orders" integer not null default 0,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "last_order_at" timestamp with time zone,
    "deleted_at" timestamp with time zone
      );


alter table "public"."customers" enable row level security;


  create table "public"."email_verifications" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "phone" text not null,
    "email" text not null,
    "otp_hash" text not null,
    "expires_at" timestamp with time zone not null,
    "verified_at" timestamp with time zone,
    "attempts" integer not null default 0,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."email_verifications" enable row level security;


  create table "public"."login_attempts" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "phone" text not null,
    "ip_address" text,
    "user_agent" text,
    "success" boolean not null default false,
    "failure_reason" text,
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."login_attempts" enable row level security;


  create table "public"."measurements" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "customer_id" uuid not null,
    "shop_id" uuid not null,
    "garment_type" text not null,
    "values" jsonb not null default '{}'::jsonb,
    "notes" text,
    "taken_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone,
    "order_for_relation" text not null default 'self'::text,
    "order_for_name" text,
    "recipient_gender" text
      );


alter table "public"."measurements" enable row level security;


  create table "public"."order_photos" (
    "id" uuid not null,
    "order_id" uuid not null,
    "shop_id" uuid not null,
    "type" text not null,
    "cloud_url" text not null,
    "public_id" text not null,
    "cloud_size_kb" integer,
    "size_kb" integer not null default 0,
    "taken_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone
      );


alter table "public"."order_photos" enable row level security;


  create table "public"."order_status_history" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "order_id" uuid not null,
    "old_status" text,
    "new_status" text not null,
    "changed_by" uuid not null,
    "changed_at" timestamp with time zone not null default now(),
    "shop_id" uuid not null
      );


alter table "public"."order_status_history" enable row level security;


  create table "public"."orders" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "shop_id" uuid not null,
    "order_number" integer not null,
    "customer_id" uuid not null,
    "customer_name" text not null,
    "customer_phone" text not null,
    "measurement_id" uuid,
    "garment_type" text not null,
    "status" text not null default 'received'::text,
    "assigned_to" uuid,
    "assigned_to_name" text,
    "total_price" numeric(10,2) not null default 0,
    "amount_paid" numeric(10,2) not null default 0,
    "is_urgent" boolean not null default false,
    "due_date" date not null,
    "special_instructions" text,
    "fabric_photo_url" text,
    "style_photo_url" text,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "delivered_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "tracking_code" text,
    "order_for_relation" text not null default 'self'::text,
    "order_for_name" text,
    "recipient_gender" text
      );


alter table "public"."orders" enable row level security;


  create table "public"."payments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "shop_id" uuid not null,
    "order_id" uuid not null,
    "amount" numeric(10,2) not null,
    "method" text not null default 'cash'::text,
    "recorded_by" uuid not null,
    "paid_at" timestamp with time zone not null default now(),
    "notes" text,
    "deleted_at" timestamp with time zone,
    "applied_to_balance" numeric default 0,
    "kind" text default 'order_payment'::text
      );


alter table "public"."payments" enable row level security;


  create table "public"."plan_limits" (
    "plan" text not null,
    "max_orders_per_month" integer,
    "max_customers" integer,
    "max_karigar" integer,
    "max_storage_kb" integer,
    "has_tracking_url" boolean default false,
    "has_qr_code" boolean default false,
    "has_photos" boolean default false,
    "has_cloud_sync" boolean default false,
    "has_analytics" boolean default false,
    "has_multi_device" boolean default false,
    "has_priority_support" boolean default false,
    "has_custom_branding" boolean default false,
    "has_karigar_pay_reports" boolean default false
      );


alter table "public"."plan_limits" enable row level security;


  create table "public"."push_subscriptions" (
    "id" uuid not null default gen_random_uuid(),
    "shop_id" uuid not null,
    "member_id" uuid,
    "endpoint" text not null,
    "p256dh" text not null,
    "auth" text not null,
    "user_agent" text,
    "last_seen_at" timestamp with time zone not null default now(),
    "created_at" timestamp with time zone not null default now()
      );


alter table "public"."push_subscriptions" enable row level security;


  create table "public"."shop_usage" (
    "shop_id" uuid not null,
    "orders_this_month" integer not null default 0,
    "customers_total" integer not null default 0,
    "karigar_count" integer not null default 0,
    "storage_used_kb" integer not null default 0,
    "month_year" text not null default to_char(now(), 'YYYY-MM'::text),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."shop_usage" enable row level security;


  create table "public"."shop_verification_requests" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "shop_id" uuid,
    "owner_name" text not null,
    "owner_phone" text not null,
    "owner_email" text,
    "business_type" text,
    "city" text,
    "status" text not null default 'pending'::text,
    "admin_note" text,
    "notification_sent" boolean default false,
    "requested_at" timestamp with time zone not null default now(),
    "reviewed_at" timestamp with time zone,
    "reviewed_by" text,
    "state_province" text,
    "address_line" text,
    "postal_code" text
      );


alter table "public"."shop_verification_requests" enable row level security;


  create table "public"."shops" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "owner_phone" text not null,
    "shop_name" text not null,
    "whatsapp_number" text,
    "city" text,
    "plan" text not null default 'starter'::text,
    "plan_expires_at" timestamp with time zone,
    "is_active" boolean not null default true,
    "created_at" timestamp with time zone not null default now(),
    "updated_at" timestamp with time zone not null default now(),
    "brand_name" text,
    "brand_color" text,
    "brand_logo_url" text,
    "verification_status" text not null default 'pending'::text,
    "verified_at" timestamp with time zone,
    "owner_email" text,
    "state_province" text,
    "address_line" text,
    "postal_code" text,
    "owner_name" text,
    "encrypted_owner_pin" text
      );


alter table "public"."shops" enable row level security;


  create table "public"."subscription_payments" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "subscription_id" uuid,
    "shop_id" uuid not null,
    "plan" text not null,
    "billing_cycle" text,
    "amount_pkr" numeric(10,2) not null,
    "method" text,
    "gateway_tx_id" text,
    "status" text not null default 'completed'::text,
    "paid_at" timestamp with time zone default now(),
    "receipt_data" jsonb
      );


alter table "public"."subscription_payments" enable row level security;


  create table "public"."subscriptions" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "shop_id" uuid not null,
    "plan" text not null default 'starter'::text,
    "billing_cycle" text,
    "status" text not null default 'trialing'::text,
    "started_at" timestamp with time zone not null default now(),
    "trial_ends_at" timestamp with time zone default (now() + '14 days'::interval),
    "expires_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "grace_ends_at" timestamp with time zone,
    "gateway" text default 'safepay'::text,
    "gateway_sub_id" text,
    "amount_pkr" numeric(10,2),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."subscriptions" enable row level security;


  create table "public"."team_members" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "shop_id" uuid not null,
    "name" text not null,
    "phone" text not null,
    "role" text not null,
    "pin_hash" text not null,
    "speciality" text,
    "pay_rate_type" text,
    "pay_rate" numeric(10,2),
    "is_active" boolean not null default true,
    "joined_at" date not null default CURRENT_DATE,
    "created_at" timestamp with time zone not null default now(),
    "deleted_at" timestamp with time zone,
    "email" text,
    "email_verified" boolean not null default false,
    "failed_attempts" integer not null default 0,
    "locked_until" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "auth_user_id" uuid,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."team_members" enable row level security;

CREATE UNIQUE INDEX admin_audit_log_pkey ON public.admin_audit_log USING btree (id);

CREATE INDEX admin_notifications_expires_at_idx ON public.admin_notifications USING btree (expires_at);

CREATE UNIQUE INDEX admin_notifications_pkey ON public.admin_notifications USING btree (id);

CREATE INDEX admin_notifications_target_plan_idx ON public.admin_notifications USING btree (target_plan);

CREATE UNIQUE INDEX customers_pkey ON public.customers USING btree (id);

CREATE INDEX customers_shop_id_idx ON public.customers USING btree (shop_id);

CREATE UNIQUE INDEX customers_shop_id_phone_key ON public.customers USING btree (shop_id, phone);

CREATE UNIQUE INDEX email_verifications_pkey ON public.email_verifications USING btree (id);

CREATE INDEX idx_admin_audit_log_action ON public.admin_audit_log USING btree (action);

CREATE INDEX idx_admin_audit_log_performed ON public.admin_audit_log USING btree (performed_at DESC);

CREATE INDEX idx_admin_audit_log_performed_at ON public.admin_audit_log USING btree (performed_at DESC);

CREATE INDEX idx_admin_audit_log_shop ON public.admin_audit_log USING btree (shop_id);

CREATE INDEX idx_admin_notifications_expires ON public.admin_notifications USING btree (expires_at);

CREATE INDEX idx_admin_notifications_type ON public.admin_notifications USING btree (type);

CREATE INDEX idx_audit_action ON public.admin_audit_log USING btree (action);

CREATE INDEX idx_audit_log_date ON public.admin_audit_log USING btree (performed_at DESC);

CREATE INDEX idx_audit_performed_at ON public.admin_audit_log USING btree (performed_at DESC);

CREATE INDEX idx_audit_shop_id ON public.admin_audit_log USING btree (shop_id);

CREATE INDEX idx_customers_created_at ON public.customers USING btree (shop_id, created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_customers_last_order ON public.customers USING btree (shop_id, last_order_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_customers_last_order_at ON public.customers USING btree (shop_id, last_order_at DESC);

CREATE INDEX idx_customers_name ON public.customers USING btree (shop_id, name) WHERE (deleted_at IS NULL);

CREATE INDEX idx_customers_name_ilike ON public.customers USING gin (name public.gin_trgm_ops);

CREATE INDEX idx_customers_phone ON public.customers USING btree (shop_id, phone) WHERE (deleted_at IS NULL);

CREATE INDEX idx_customers_shop ON public.customers USING btree (shop_id);

CREATE INDEX idx_customers_shop_id ON public.customers USING btree (shop_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_customers_shop_id_phone ON public.customers USING btree (shop_id, phone);

CREATE INDEX idx_customers_shop_last_order ON public.customers USING btree (shop_id, last_order_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_email_verif_lookup ON public.email_verifications USING btree (phone, expires_at, verified_at);

CREATE INDEX idx_email_verif_phone ON public.email_verifications USING btree (phone, created_at DESC);

CREATE INDEX idx_email_verifications_phone ON public.email_verifications USING btree (phone);

CREATE INDEX idx_login_attempts_created_at ON public.login_attempts USING btree (created_at DESC);

CREATE INDEX idx_login_attempts_ip ON public.login_attempts USING btree (ip_address, created_at DESC);

CREATE INDEX idx_login_attempts_phone ON public.login_attempts USING btree (phone, created_at DESC);

CREATE INDEX idx_measurements_customer ON public.measurements USING btree (customer_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_measurements_customer_id ON public.measurements USING btree (customer_id);

CREATE INDEX idx_measurements_customer_recipient ON public.measurements USING btree (customer_id, garment_type, order_for_relation, order_for_name, taken_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_measurements_customer_recipient_garment ON public.measurements USING btree (customer_id, order_for_relation, order_for_name, garment_type);

CREATE INDEX idx_measurements_shop_id ON public.measurements USING btree (shop_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_order_photos_deleted_at ON public.order_photos USING btree (deleted_at);

CREATE INDEX idx_order_photos_order ON public.order_photos USING btree (order_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_order_photos_order_id ON public.order_photos USING btree (order_id);

CREATE INDEX idx_order_photos_shop_id ON public.order_photos USING btree (shop_id);

CREATE INDEX idx_order_photos_shop_order ON public.order_photos USING btree (shop_id, order_id);

CREATE INDEX idx_order_status_history_order ON public.order_status_history USING btree (order_id);

CREATE INDEX idx_order_status_history_order_id ON public.order_status_history USING btree (order_id);

CREATE INDEX idx_order_status_history_shop ON public.order_status_history USING btree (shop_id);

CREATE INDEX idx_order_status_history_shop_order ON public.order_status_history USING btree (shop_id, order_id, changed_at DESC);

CREATE INDEX idx_orders_assigned ON public.orders USING btree (assigned_to) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_assigned_to ON public.orders USING btree (assigned_to);

CREATE INDEX idx_orders_created_at ON public.orders USING btree (shop_id, created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_customer ON public.orders USING btree (shop_id, customer_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);

CREATE INDEX idx_orders_due_date ON public.orders USING btree (shop_id, due_date) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_order_number ON public.orders USING btree (shop_id, order_number);

CREATE INDEX idx_orders_overdue ON public.orders USING btree (shop_id, due_date, status) WHERE ((deleted_at IS NULL) AND (status <> ALL (ARRAY['delivered'::text, 'cancelled'::text])));

CREATE INDEX idx_orders_shop_active ON public.orders USING btree (shop_id, status) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_assigned_to ON public.orders USING btree (shop_id, assigned_to) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_created ON public.orders USING btree (shop_id, created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_created_at ON public.orders USING btree (shop_id, created_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_customer_id ON public.orders USING btree (shop_id, customer_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_due_date ON public.orders USING btree (shop_id, due_date) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_id ON public.orders USING btree (shop_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_order_number ON public.orders USING btree (shop_id, order_number) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_recipient_expiry ON public.orders USING btree (shop_id, order_for_relation, recipient_gender, due_date);

CREATE INDEX idx_orders_shop_status ON public.orders USING btree (shop_id, status) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_status ON public.orders USING btree (shop_id, status) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_tracking ON public.orders USING btree (tracking_code) WHERE (tracking_code IS NOT NULL);

CREATE INDEX idx_orders_tracking_code ON public.orders USING btree (tracking_code) WHERE (deleted_at IS NULL);

CREATE INDEX idx_payments_method ON public.payments USING btree (shop_id, method) WHERE (deleted_at IS NULL);

CREATE INDEX idx_payments_order ON public.payments USING btree (order_id);

CREATE INDEX idx_payments_order_active ON public.payments USING btree (order_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_payments_order_id ON public.payments USING btree (order_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_payments_paid_at ON public.payments USING btree (shop_id, paid_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_payments_shop_id ON public.payments USING btree (shop_id) WHERE (deleted_at IS NULL);

CREATE INDEX idx_payments_shop_paid ON public.payments USING btree (shop_id, paid_at DESC);

CREATE INDEX idx_payments_shop_paid_at ON public.payments USING btree (shop_id, paid_at DESC) WHERE (deleted_at IS NULL);

CREATE INDEX idx_push_subscriptions_shop ON public.push_subscriptions USING btree (shop_id, last_seen_at DESC);

CREATE INDEX idx_shop_usage_month ON public.shop_usage USING btree (month_year);

CREATE INDEX idx_shop_usage_shop_id ON public.shop_usage USING btree (shop_id);

CREATE INDEX idx_shop_verif_requests_shop ON public.shop_verification_requests USING btree (shop_id);

CREATE INDEX idx_shop_verif_requests_status ON public.shop_verification_requests USING btree (status);

CREATE INDEX idx_shop_verif_shop ON public.shop_verification_requests USING btree (shop_id);

CREATE INDEX idx_shop_verif_status ON public.shop_verification_requests USING btree (status, requested_at DESC);

CREATE INDEX idx_shops_created_at ON public.shops USING btree (created_at);

CREATE INDEX idx_shops_is_active ON public.shops USING btree (is_active);

CREATE INDEX idx_shops_owner_phone ON public.shops USING btree (owner_phone);

CREATE INDEX idx_shops_plan ON public.shops USING btree (plan);

CREATE INDEX idx_shops_verification ON public.shops USING btree (verification_status);

CREATE INDEX idx_sub_payments_paid_at ON public.subscription_payments USING btree (paid_at DESC);

CREATE INDEX idx_sub_payments_shop_id ON public.subscription_payments USING btree (shop_id);

CREATE INDEX idx_sub_payments_status ON public.subscription_payments USING btree (status);

CREATE INDEX idx_sub_shop ON public.subscriptions USING btree (shop_id);

CREATE INDEX idx_sub_status ON public.subscriptions USING btree (status, expires_at, trial_ends_at);

CREATE INDEX idx_subscriptions_expires ON public.subscriptions USING btree (expires_at) WHERE (status = ANY (ARRAY['active'::text, 'trialing'::text]));

CREATE INDEX idx_subscriptions_plan ON public.subscriptions USING btree (plan);

CREATE INDEX idx_subscriptions_shop_id ON public.subscriptions USING btree (shop_id);

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);

CREATE INDEX idx_team_members_auth_user ON public.team_members USING btree (auth_user_id) WHERE (auth_user_id IS NOT NULL);

CREATE INDEX idx_team_members_email ON public.team_members USING btree (email) WHERE (is_active = true);

CREATE INDEX idx_team_members_phone ON public.team_members USING btree (phone) WHERE (is_active = true);

CREATE INDEX idx_team_members_phone_active ON public.team_members USING btree (phone) WHERE ((is_active = true) AND (deleted_at IS NULL));

CREATE INDEX idx_team_members_role ON public.team_members USING btree (shop_id, role);

CREATE INDEX idx_team_members_shop_active ON public.team_members USING btree (shop_id, is_active) WHERE (deleted_at IS NULL);

CREATE INDEX idx_team_members_shop_id ON public.team_members USING btree (shop_id);

CREATE INDEX idx_team_members_shop_role_active ON public.team_members USING btree (shop_id, role, is_active);

CREATE INDEX idx_team_phone ON public.team_members USING btree (phone) WHERE (deleted_at IS NULL);

CREATE INDEX login_attempts_created_idx ON public.login_attempts USING btree (created_at);

CREATE INDEX login_attempts_phone_failed_created_idx ON public.login_attempts USING btree (phone, created_at DESC) WHERE (success = false);

CREATE UNIQUE INDEX login_attempts_pkey ON public.login_attempts USING btree (id);

CREATE UNIQUE INDEX measurements_pkey ON public.measurements USING btree (id);

CREATE UNIQUE INDEX order_photos_pkey ON public.order_photos USING btree (id);

CREATE UNIQUE INDEX order_status_history_pkey ON public.order_status_history USING btree (id);

CREATE INDEX orders_customer_id_idx ON public.orders USING btree (customer_id);

CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id);

CREATE INDEX orders_shop_id_due_date_idx ON public.orders USING btree (shop_id, due_date);

CREATE UNIQUE INDEX orders_shop_id_order_number_key ON public.orders USING btree (shop_id, order_number);

CREATE INDEX orders_shop_id_status_idx ON public.orders USING btree (shop_id, status);

CREATE UNIQUE INDEX orders_tracking_code_unique ON public.orders USING btree (tracking_code) WHERE (tracking_code IS NOT NULL);

CREATE INDEX payments_order_id_idx ON public.payments USING btree (order_id);

CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id);

CREATE UNIQUE INDEX plan_limits_pkey ON public.plan_limits USING btree (plan);

CREATE UNIQUE INDEX push_subscriptions_endpoint_key ON public.push_subscriptions USING btree (endpoint);

CREATE UNIQUE INDEX push_subscriptions_pkey ON public.push_subscriptions USING btree (id);

CREATE UNIQUE INDEX shop_usage_pkey ON public.shop_usage USING btree (shop_id);

CREATE UNIQUE INDEX shop_usage_shop_id_month_year_key ON public.shop_usage USING btree (shop_id, month_year);

CREATE UNIQUE INDEX shop_verification_requests_pkey ON public.shop_verification_requests USING btree (id);

CREATE UNIQUE INDEX shop_verification_requests_shop_id_key ON public.shop_verification_requests USING btree (shop_id);

CREATE INDEX shops_is_active_idx ON public.shops USING btree (is_active);

CREATE UNIQUE INDEX shops_pkey ON public.shops USING btree (id);

CREATE UNIQUE INDEX subscription_payments_pkey ON public.subscription_payments USING btree (id);

CREATE UNIQUE INDEX subscriptions_pkey ON public.subscriptions USING btree (id);

CREATE UNIQUE INDEX subscriptions_shop_id_key ON public.subscriptions USING btree (shop_id);

CREATE INDEX team_members_phone_idx ON public.team_members USING btree (phone);

CREATE UNIQUE INDEX team_members_phone_unique ON public.team_members USING btree (phone) WHERE ((is_active = true) AND (deleted_at IS NULL));

CREATE UNIQUE INDEX team_members_pkey ON public.team_members USING btree (id);

CREATE UNIQUE INDEX team_members_shop_id_phone_key ON public.team_members USING btree (shop_id, phone);

alter table "public"."admin_audit_log" add constraint "admin_audit_log_pkey" PRIMARY KEY using index "admin_audit_log_pkey";

alter table "public"."admin_notifications" add constraint "admin_notifications_pkey" PRIMARY KEY using index "admin_notifications_pkey";

alter table "public"."customers" add constraint "customers_pkey" PRIMARY KEY using index "customers_pkey";

alter table "public"."email_verifications" add constraint "email_verifications_pkey" PRIMARY KEY using index "email_verifications_pkey";

alter table "public"."login_attempts" add constraint "login_attempts_pkey" PRIMARY KEY using index "login_attempts_pkey";

alter table "public"."measurements" add constraint "measurements_pkey" PRIMARY KEY using index "measurements_pkey";

alter table "public"."order_photos" add constraint "order_photos_pkey" PRIMARY KEY using index "order_photos_pkey";

alter table "public"."order_status_history" add constraint "order_status_history_pkey" PRIMARY KEY using index "order_status_history_pkey";

alter table "public"."orders" add constraint "orders_pkey" PRIMARY KEY using index "orders_pkey";

alter table "public"."payments" add constraint "payments_pkey" PRIMARY KEY using index "payments_pkey";

alter table "public"."plan_limits" add constraint "plan_limits_pkey" PRIMARY KEY using index "plan_limits_pkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_pkey" PRIMARY KEY using index "push_subscriptions_pkey";

alter table "public"."shop_usage" add constraint "shop_usage_pkey" PRIMARY KEY using index "shop_usage_pkey";

alter table "public"."shop_verification_requests" add constraint "shop_verification_requests_pkey" PRIMARY KEY using index "shop_verification_requests_pkey";

alter table "public"."shops" add constraint "shops_pkey" PRIMARY KEY using index "shops_pkey";

alter table "public"."subscription_payments" add constraint "subscription_payments_pkey" PRIMARY KEY using index "subscription_payments_pkey";

alter table "public"."subscriptions" add constraint "subscriptions_pkey" PRIMARY KEY using index "subscriptions_pkey";

alter table "public"."team_members" add constraint "team_members_pkey" PRIMARY KEY using index "team_members_pkey";

alter table "public"."admin_audit_log" add constraint "admin_audit_log_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE SET NULL not valid;

alter table "public"."admin_audit_log" validate constraint "admin_audit_log_shop_id_fkey";

alter table "public"."admin_audit_log" add constraint "admin_audit_log_target_type_check" CHECK ((target_type = ANY (ARRAY['subscription'::text, 'payment'::text, 'shop'::text, 'user'::text, 'system'::text]))) not valid;

alter table "public"."admin_audit_log" validate constraint "admin_audit_log_target_type_check";

alter table "public"."admin_notifications" add constraint "admin_notifications_target_plan_check" CHECK ((target_plan = ANY (ARRAY['all'::text, 'starter'::text, 'professional'::text, 'business'::text]))) not valid;

alter table "public"."admin_notifications" validate constraint "admin_notifications_target_plan_check";

alter table "public"."admin_notifications" add constraint "admin_notifications_type_check" CHECK ((type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'urgent'::text]))) not valid;

alter table "public"."admin_notifications" validate constraint "admin_notifications_type_check";

alter table "public"."customers" add constraint "customers_gender_check" CHECK ((gender = ANY (ARRAY['male'::text, 'female'::text, 'child'::text]))) not valid;

alter table "public"."customers" validate constraint "customers_gender_check";

alter table "public"."customers" add constraint "customers_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."customers" validate constraint "customers_shop_id_fkey";

alter table "public"."customers" add constraint "customers_shop_id_phone_key" UNIQUE using index "customers_shop_id_phone_key";

alter table "public"."measurements" add constraint "measurements_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE not valid;

alter table "public"."measurements" validate constraint "measurements_customer_id_fkey";

alter table "public"."measurements" add constraint "measurements_order_for_relation_check" CHECK ((order_for_relation = ANY (ARRAY['self'::text, 'wife'::text, 'husband'::text, 'son'::text, 'daughter'::text, 'brother'::text, 'sister'::text, 'father'::text, 'mother'::text, 'other'::text]))) not valid;

alter table "public"."measurements" validate constraint "measurements_order_for_relation_check";

alter table "public"."measurements" add constraint "measurements_recipient_gender_check" CHECK (((recipient_gender IS NULL) OR (recipient_gender = ANY (ARRAY['male'::text, 'female'::text, 'child'::text])))) not valid;

alter table "public"."measurements" validate constraint "measurements_recipient_gender_check";

alter table "public"."measurements" add constraint "measurements_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."measurements" validate constraint "measurements_shop_id_fkey";

alter table "public"."order_photos" add constraint "order_photos_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."order_photos" validate constraint "order_photos_order_id_fkey";

alter table "public"."order_photos" add constraint "order_photos_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."order_photos" validate constraint "order_photos_shop_id_fkey";

alter table "public"."order_photos" add constraint "order_photos_type_check" CHECK ((type = ANY (ARRAY['fabric'::text, 'style'::text, 'reference'::text]))) not valid;

alter table "public"."order_photos" validate constraint "order_photos_type_check";

alter table "public"."order_status_history" add constraint "order_status_history_changed_by_fkey" FOREIGN KEY (changed_by) REFERENCES public.team_members(id) not valid;

alter table "public"."order_status_history" validate constraint "order_status_history_changed_by_fkey";

alter table "public"."order_status_history" add constraint "order_status_history_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."order_status_history" validate constraint "order_status_history_order_id_fkey";

alter table "public"."orders" add constraint "orders_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES public.team_members(id) not valid;

alter table "public"."orders" validate constraint "orders_assigned_to_fkey";

alter table "public"."orders" add constraint "orders_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE not valid;

alter table "public"."orders" validate constraint "orders_customer_id_fkey";

alter table "public"."orders" add constraint "orders_measurement_id_fkey" FOREIGN KEY (measurement_id) REFERENCES public.measurements(id) not valid;

alter table "public"."orders" validate constraint "orders_measurement_id_fkey";

alter table "public"."orders" add constraint "orders_order_for_relation_check" CHECK ((order_for_relation = ANY (ARRAY['self'::text, 'wife'::text, 'husband'::text, 'son'::text, 'daughter'::text, 'brother'::text, 'sister'::text, 'father'::text, 'mother'::text, 'other'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_order_for_relation_check";

alter table "public"."orders" add constraint "orders_recipient_gender_check" CHECK (((recipient_gender IS NULL) OR (recipient_gender = ANY (ARRAY['male'::text, 'female'::text, 'child'::text])))) not valid;

alter table "public"."orders" validate constraint "orders_recipient_gender_check";

alter table "public"."orders" add constraint "orders_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."orders" validate constraint "orders_shop_id_fkey";

alter table "public"."orders" add constraint "orders_shop_id_order_number_key" UNIQUE using index "orders_shop_id_order_number_key";

alter table "public"."orders" add constraint "orders_status_check" CHECK ((status = ANY (ARRAY['received'::text, 'cutting'::text, 'stitching'::text, 'finishing'::text, 'ready'::text, 'delivered'::text, 'cancelled'::text]))) not valid;

alter table "public"."orders" validate constraint "orders_status_check";

alter table "public"."payments" add constraint "payments_kind_check" CHECK ((kind = ANY (ARRAY['order_payment'::text, 'tip'::text, 'overpayment'::text]))) not valid;

alter table "public"."payments" validate constraint "payments_kind_check";

alter table "public"."payments" add constraint "payments_method_check" CHECK ((method = ANY (ARRAY['cash'::text, 'card'::text, 'transfer'::text, 'online'::text, 'other'::text]))) not valid;

alter table "public"."payments" validate constraint "payments_method_check";

alter table "public"."payments" add constraint "payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_order_id_fkey";

alter table "public"."payments" add constraint "payments_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES public.team_members(id) not valid;

alter table "public"."payments" validate constraint "payments_recorded_by_fkey";

alter table "public"."payments" add constraint "payments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_shop_id_fkey";

alter table "public"."push_subscriptions" add constraint "push_subscriptions_endpoint_key" UNIQUE using index "push_subscriptions_endpoint_key";

alter table "public"."shop_usage" add constraint "shop_usage_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) not valid;

alter table "public"."shop_usage" validate constraint "shop_usage_shop_id_fkey";

alter table "public"."shop_usage" add constraint "shop_usage_shop_id_month_year_key" UNIQUE using index "shop_usage_shop_id_month_year_key";

alter table "public"."shop_verification_requests" add constraint "shop_verification_requests_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."shop_verification_requests" validate constraint "shop_verification_requests_shop_id_fkey";

alter table "public"."shop_verification_requests" add constraint "shop_verification_requests_shop_id_key" UNIQUE using index "shop_verification_requests_shop_id_key";

alter table "public"."shop_verification_requests" add constraint "shop_verification_requests_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."shop_verification_requests" validate constraint "shop_verification_requests_status_check";

alter table "public"."shops" add constraint "shops_plan_check" CHECK ((plan = ANY (ARRAY['starter'::text, 'professional'::text, 'business'::text]))) not valid;

alter table "public"."shops" validate constraint "shops_plan_check";

alter table "public"."shops" add constraint "shops_verification_status_check" CHECK ((verification_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))) not valid;

alter table "public"."shops" validate constraint "shops_verification_status_check";

alter table "public"."subscription_payments" add constraint "subscription_payments_method_check" CHECK ((method = ANY (ARRAY['raast'::text, 'reminder'::text]))) not valid;

alter table "public"."subscription_payments" validate constraint "subscription_payments_method_check";

alter table "public"."subscription_payments" add constraint "subscription_payments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) not valid;

alter table "public"."subscription_payments" validate constraint "subscription_payments_shop_id_fkey";

alter table "public"."subscription_payments" add constraint "subscription_payments_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'completed'::text, 'failed'::text, 'refunded'::text]))) not valid;

alter table "public"."subscription_payments" validate constraint "subscription_payments_status_check";

alter table "public"."subscription_payments" add constraint "subscription_payments_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) not valid;

alter table "public"."subscription_payments" validate constraint "subscription_payments_subscription_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_billing_cycle_check" CHECK (((billing_cycle IS NULL) OR (billing_cycle = ANY (ARRAY['monthly'::text, 'yearly'::text, 'lifetime'::text])))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_billing_cycle_check";

alter table "public"."subscriptions" add constraint "subscriptions_plan_check" CHECK ((plan = ANY (ARRAY['starter'::text, 'professional'::text, 'business'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_plan_check";

alter table "public"."subscriptions" add constraint "subscriptions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_shop_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_shop_id_key" UNIQUE using index "subscriptions_shop_id_key";

alter table "public"."subscriptions" add constraint "subscriptions_status_check" CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'cancelled'::text, 'grace'::text, 'expired'::text]))) not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_status_check";

alter table "public"."team_members" add constraint "team_members_pay_rate_type_check" CHECK ((pay_rate_type = ANY (ARRAY['daily'::text, 'per_order'::text, 'monthly'::text]))) not valid;

alter table "public"."team_members" validate constraint "team_members_pay_rate_type_check";

alter table "public"."team_members" add constraint "team_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'karigar'::text, 'manager'::text]))) not valid;

alter table "public"."team_members" validate constraint "team_members_role_check";

alter table "public"."team_members" add constraint "team_members_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_shop_id_fkey";

alter table "public"."team_members" add constraint "team_members_shop_id_phone_key" UNIQUE using index "team_members_shop_id_phone_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.current_shop_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$ SELECT nullif(current_setting('app.current_shop_id', true), '')::UUID $function$
;

CREATE OR REPLACE FUNCTION public.handle_new_shop()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.subscriptions (
    shop_id,
    plan,
    status,
    trial_ends_at,
    expires_at,
    billing_cycle,
    amount_pkr
  ) VALUES (
    NEW.id,
    'starter',
    'active',
    NULL,
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (shop_id) DO NOTHING;

  INSERT INTO public.shop_usage (
    shop_id,
    orders_this_month,
    customers_total,
    karigar_count,
    storage_used_kb
  ) VALUES (NEW.id, 0, 0, 0, 0)
  ON CONFLICT (shop_id) DO NOTHING;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.prune_login_attempts()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  delete from public.login_attempts
  where created_at < now() - interval '14 days';

  if new.success = false then
    delete from public.login_attempts la
    using (
      select ctid
      from (
        select ctid,
               row_number() over (order by created_at desc) as rn
        from public.login_attempts
        where phone = new.phone
          and success = false
          and created_at >= now() - interval '1 hour'
      ) ranked
      where rn > 10
    ) doomed
    where la.ctid = doomed.ctid;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_shop_karigar_count(target_shop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.shop_usage (shop_id, karigar_count, orders_this_month, customers_total, storage_used_kb, month_year, updated_at)
  values (target_shop_id, 0, 0, 0, 0, to_char(now(), 'YYYY-MM'), now())
  on conflict (shop_id) do nothing;

  update public.shop_usage
  set karigar_count = (
      select count(*)
      from public.team_members
      where shop_id = target_shop_id
        and role = 'karigar'
        and is_active = true
        and deleted_at is null
    ),
    updated_at = now()
  where shop_id = target_shop_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_app_shop_id(shop_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM set_config('app.shop_id', shop_id, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_order_customer_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.name is distinct from old.name
     or new.phone is distinct from old.phone then
    update public.orders
       set customer_name = new.name,
           customer_phone = new.phone,
           updated_at = coalesce(new.updated_at, now())
     where customer_id = new.id
       and deleted_at is null;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_shop_plan()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE public.shops
    SET plan = NEW.plan, updated_at = now()
    WHERE id = NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.team_members_refresh_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  perform public.refresh_shop_karigar_count(coalesce(new.shop_id, old.shop_id));
  return coalesce(new, old);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.track_customer_usage()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.shop_usage
    SET customers_total = customers_total + 1, updated_at = now()
    WHERE shop_id = NEW.shop_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.shop_usage
    SET customers_total = GREATEST(0, customers_total - 1), updated_at = now()
    WHERE shop_id = NEW.shop_id;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_karigar_usage()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.shop_usage
  SET karigar_count = (
    SELECT COUNT(*) FROM public.team_members
    WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)
    AND role = 'karigar'
    AND is_active = true
    AND deleted_at IS NULL
  ),
  updated_at = now()
  WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id);
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_order_usage()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.shop_usage (shop_id, orders_this_month)
  VALUES (NEW.shop_id, 1)
  ON CONFLICT (shop_id)
  DO UPDATE SET
    orders_this_month = public.shop_usage.orders_this_month + 1,
    updated_at        = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.unassign_orders_for_removed_karigar()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.role = 'karigar'
     and (tg_op = 'DELETE'
          or new.is_active = false
          or new.deleted_at is not null) then
    update public.orders
    set assigned_to = null,
        assigned_to_name = null,
        updated_at = now()
    where assigned_to = old.id
      and deleted_at is null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$function$
;

grant delete on table "public"."admin_audit_log" to "anon";

grant insert on table "public"."admin_audit_log" to "anon";

grant references on table "public"."admin_audit_log" to "anon";

grant select on table "public"."admin_audit_log" to "anon";

grant trigger on table "public"."admin_audit_log" to "anon";

grant truncate on table "public"."admin_audit_log" to "anon";

grant update on table "public"."admin_audit_log" to "anon";

grant delete on table "public"."admin_audit_log" to "authenticated";

grant insert on table "public"."admin_audit_log" to "authenticated";

grant references on table "public"."admin_audit_log" to "authenticated";

grant select on table "public"."admin_audit_log" to "authenticated";

grant trigger on table "public"."admin_audit_log" to "authenticated";

grant truncate on table "public"."admin_audit_log" to "authenticated";

grant update on table "public"."admin_audit_log" to "authenticated";

grant delete on table "public"."admin_audit_log" to "service_role";

grant insert on table "public"."admin_audit_log" to "service_role";

grant references on table "public"."admin_audit_log" to "service_role";

grant select on table "public"."admin_audit_log" to "service_role";

grant trigger on table "public"."admin_audit_log" to "service_role";

grant truncate on table "public"."admin_audit_log" to "service_role";

grant update on table "public"."admin_audit_log" to "service_role";

grant delete on table "public"."admin_notifications" to "anon";

grant insert on table "public"."admin_notifications" to "anon";

grant references on table "public"."admin_notifications" to "anon";

grant select on table "public"."admin_notifications" to "anon";

grant trigger on table "public"."admin_notifications" to "anon";

grant truncate on table "public"."admin_notifications" to "anon";

grant update on table "public"."admin_notifications" to "anon";

grant delete on table "public"."admin_notifications" to "authenticated";

grant insert on table "public"."admin_notifications" to "authenticated";

grant references on table "public"."admin_notifications" to "authenticated";

grant select on table "public"."admin_notifications" to "authenticated";

grant trigger on table "public"."admin_notifications" to "authenticated";

grant truncate on table "public"."admin_notifications" to "authenticated";

grant update on table "public"."admin_notifications" to "authenticated";

grant delete on table "public"."admin_notifications" to "service_role";

grant insert on table "public"."admin_notifications" to "service_role";

grant references on table "public"."admin_notifications" to "service_role";

grant select on table "public"."admin_notifications" to "service_role";

grant trigger on table "public"."admin_notifications" to "service_role";

grant truncate on table "public"."admin_notifications" to "service_role";

grant update on table "public"."admin_notifications" to "service_role";

grant delete on table "public"."customers" to "anon";

grant insert on table "public"."customers" to "anon";

grant references on table "public"."customers" to "anon";

grant select on table "public"."customers" to "anon";

grant trigger on table "public"."customers" to "anon";

grant truncate on table "public"."customers" to "anon";

grant update on table "public"."customers" to "anon";

grant delete on table "public"."customers" to "authenticated";

grant insert on table "public"."customers" to "authenticated";

grant references on table "public"."customers" to "authenticated";

grant select on table "public"."customers" to "authenticated";

grant trigger on table "public"."customers" to "authenticated";

grant truncate on table "public"."customers" to "authenticated";

grant update on table "public"."customers" to "authenticated";

grant delete on table "public"."customers" to "service_role";

grant insert on table "public"."customers" to "service_role";

grant references on table "public"."customers" to "service_role";

grant select on table "public"."customers" to "service_role";

grant trigger on table "public"."customers" to "service_role";

grant truncate on table "public"."customers" to "service_role";

grant update on table "public"."customers" to "service_role";

grant delete on table "public"."email_verifications" to "anon";

grant insert on table "public"."email_verifications" to "anon";

grant references on table "public"."email_verifications" to "anon";

grant select on table "public"."email_verifications" to "anon";

grant trigger on table "public"."email_verifications" to "anon";

grant truncate on table "public"."email_verifications" to "anon";

grant update on table "public"."email_verifications" to "anon";

grant delete on table "public"."email_verifications" to "authenticated";

grant insert on table "public"."email_verifications" to "authenticated";

grant references on table "public"."email_verifications" to "authenticated";

grant select on table "public"."email_verifications" to "authenticated";

grant trigger on table "public"."email_verifications" to "authenticated";

grant truncate on table "public"."email_verifications" to "authenticated";

grant update on table "public"."email_verifications" to "authenticated";

grant delete on table "public"."email_verifications" to "service_role";

grant insert on table "public"."email_verifications" to "service_role";

grant references on table "public"."email_verifications" to "service_role";

grant select on table "public"."email_verifications" to "service_role";

grant trigger on table "public"."email_verifications" to "service_role";

grant truncate on table "public"."email_verifications" to "service_role";

grant update on table "public"."email_verifications" to "service_role";

grant delete on table "public"."login_attempts" to "anon";

grant insert on table "public"."login_attempts" to "anon";

grant references on table "public"."login_attempts" to "anon";

grant select on table "public"."login_attempts" to "anon";

grant trigger on table "public"."login_attempts" to "anon";

grant truncate on table "public"."login_attempts" to "anon";

grant update on table "public"."login_attempts" to "anon";

grant delete on table "public"."login_attempts" to "authenticated";

grant insert on table "public"."login_attempts" to "authenticated";

grant references on table "public"."login_attempts" to "authenticated";

grant select on table "public"."login_attempts" to "authenticated";

grant trigger on table "public"."login_attempts" to "authenticated";

grant truncate on table "public"."login_attempts" to "authenticated";

grant update on table "public"."login_attempts" to "authenticated";

grant delete on table "public"."login_attempts" to "service_role";

grant insert on table "public"."login_attempts" to "service_role";

grant references on table "public"."login_attempts" to "service_role";

grant select on table "public"."login_attempts" to "service_role";

grant trigger on table "public"."login_attempts" to "service_role";

grant truncate on table "public"."login_attempts" to "service_role";

grant update on table "public"."login_attempts" to "service_role";

grant delete on table "public"."measurements" to "anon";

grant insert on table "public"."measurements" to "anon";

grant references on table "public"."measurements" to "anon";

grant select on table "public"."measurements" to "anon";

grant trigger on table "public"."measurements" to "anon";

grant truncate on table "public"."measurements" to "anon";

grant update on table "public"."measurements" to "anon";

grant delete on table "public"."measurements" to "authenticated";

grant insert on table "public"."measurements" to "authenticated";

grant references on table "public"."measurements" to "authenticated";

grant select on table "public"."measurements" to "authenticated";

grant trigger on table "public"."measurements" to "authenticated";

grant truncate on table "public"."measurements" to "authenticated";

grant update on table "public"."measurements" to "authenticated";

grant delete on table "public"."measurements" to "service_role";

grant insert on table "public"."measurements" to "service_role";

grant references on table "public"."measurements" to "service_role";

grant select on table "public"."measurements" to "service_role";

grant trigger on table "public"."measurements" to "service_role";

grant truncate on table "public"."measurements" to "service_role";

grant update on table "public"."measurements" to "service_role";

grant delete on table "public"."order_photos" to "anon";

grant insert on table "public"."order_photos" to "anon";

grant references on table "public"."order_photos" to "anon";

grant select on table "public"."order_photos" to "anon";

grant trigger on table "public"."order_photos" to "anon";

grant truncate on table "public"."order_photos" to "anon";

grant update on table "public"."order_photos" to "anon";

grant delete on table "public"."order_photos" to "authenticated";

grant insert on table "public"."order_photos" to "authenticated";

grant references on table "public"."order_photos" to "authenticated";

grant select on table "public"."order_photos" to "authenticated";

grant trigger on table "public"."order_photos" to "authenticated";

grant truncate on table "public"."order_photos" to "authenticated";

grant update on table "public"."order_photos" to "authenticated";

grant delete on table "public"."order_photos" to "service_role";

grant insert on table "public"."order_photos" to "service_role";

grant references on table "public"."order_photos" to "service_role";

grant select on table "public"."order_photos" to "service_role";

grant trigger on table "public"."order_photos" to "service_role";

grant truncate on table "public"."order_photos" to "service_role";

grant update on table "public"."order_photos" to "service_role";

grant delete on table "public"."order_status_history" to "anon";

grant insert on table "public"."order_status_history" to "anon";

grant references on table "public"."order_status_history" to "anon";

grant select on table "public"."order_status_history" to "anon";

grant trigger on table "public"."order_status_history" to "anon";

grant truncate on table "public"."order_status_history" to "anon";

grant update on table "public"."order_status_history" to "anon";

grant delete on table "public"."order_status_history" to "authenticated";

grant insert on table "public"."order_status_history" to "authenticated";

grant references on table "public"."order_status_history" to "authenticated";

grant select on table "public"."order_status_history" to "authenticated";

grant trigger on table "public"."order_status_history" to "authenticated";

grant truncate on table "public"."order_status_history" to "authenticated";

grant update on table "public"."order_status_history" to "authenticated";

grant delete on table "public"."order_status_history" to "service_role";

grant insert on table "public"."order_status_history" to "service_role";

grant references on table "public"."order_status_history" to "service_role";

grant select on table "public"."order_status_history" to "service_role";

grant trigger on table "public"."order_status_history" to "service_role";

grant truncate on table "public"."order_status_history" to "service_role";

grant update on table "public"."order_status_history" to "service_role";

grant delete on table "public"."orders" to "anon";

grant insert on table "public"."orders" to "anon";

grant references on table "public"."orders" to "anon";

grant select on table "public"."orders" to "anon";

grant trigger on table "public"."orders" to "anon";

grant truncate on table "public"."orders" to "anon";

grant update on table "public"."orders" to "anon";

grant delete on table "public"."orders" to "authenticated";

grant insert on table "public"."orders" to "authenticated";

grant references on table "public"."orders" to "authenticated";

grant select on table "public"."orders" to "authenticated";

grant trigger on table "public"."orders" to "authenticated";

grant truncate on table "public"."orders" to "authenticated";

grant update on table "public"."orders" to "authenticated";

grant delete on table "public"."orders" to "service_role";

grant insert on table "public"."orders" to "service_role";

grant references on table "public"."orders" to "service_role";

grant select on table "public"."orders" to "service_role";

grant trigger on table "public"."orders" to "service_role";

grant truncate on table "public"."orders" to "service_role";

grant update on table "public"."orders" to "service_role";

grant delete on table "public"."payments" to "anon";

grant insert on table "public"."payments" to "anon";

grant references on table "public"."payments" to "anon";

grant select on table "public"."payments" to "anon";

grant trigger on table "public"."payments" to "anon";

grant truncate on table "public"."payments" to "anon";

grant update on table "public"."payments" to "anon";

grant delete on table "public"."payments" to "authenticated";

grant insert on table "public"."payments" to "authenticated";

grant references on table "public"."payments" to "authenticated";

grant select on table "public"."payments" to "authenticated";

grant trigger on table "public"."payments" to "authenticated";

grant truncate on table "public"."payments" to "authenticated";

grant update on table "public"."payments" to "authenticated";

grant delete on table "public"."payments" to "service_role";

grant insert on table "public"."payments" to "service_role";

grant references on table "public"."payments" to "service_role";

grant select on table "public"."payments" to "service_role";

grant trigger on table "public"."payments" to "service_role";

grant truncate on table "public"."payments" to "service_role";

grant update on table "public"."payments" to "service_role";

grant delete on table "public"."plan_limits" to "anon";

grant insert on table "public"."plan_limits" to "anon";

grant references on table "public"."plan_limits" to "anon";

grant select on table "public"."plan_limits" to "anon";

grant trigger on table "public"."plan_limits" to "anon";

grant truncate on table "public"."plan_limits" to "anon";

grant update on table "public"."plan_limits" to "anon";

grant delete on table "public"."plan_limits" to "authenticated";

grant insert on table "public"."plan_limits" to "authenticated";

grant references on table "public"."plan_limits" to "authenticated";

grant select on table "public"."plan_limits" to "authenticated";

grant trigger on table "public"."plan_limits" to "authenticated";

grant truncate on table "public"."plan_limits" to "authenticated";

grant update on table "public"."plan_limits" to "authenticated";

grant delete on table "public"."plan_limits" to "service_role";

grant insert on table "public"."plan_limits" to "service_role";

grant references on table "public"."plan_limits" to "service_role";

grant select on table "public"."plan_limits" to "service_role";

grant trigger on table "public"."plan_limits" to "service_role";

grant truncate on table "public"."plan_limits" to "service_role";

grant update on table "public"."plan_limits" to "service_role";

grant delete on table "public"."push_subscriptions" to "anon";

grant insert on table "public"."push_subscriptions" to "anon";

grant references on table "public"."push_subscriptions" to "anon";

grant select on table "public"."push_subscriptions" to "anon";

grant trigger on table "public"."push_subscriptions" to "anon";

grant truncate on table "public"."push_subscriptions" to "anon";

grant update on table "public"."push_subscriptions" to "anon";

grant delete on table "public"."push_subscriptions" to "authenticated";

grant insert on table "public"."push_subscriptions" to "authenticated";

grant references on table "public"."push_subscriptions" to "authenticated";

grant select on table "public"."push_subscriptions" to "authenticated";

grant trigger on table "public"."push_subscriptions" to "authenticated";

grant truncate on table "public"."push_subscriptions" to "authenticated";

grant update on table "public"."push_subscriptions" to "authenticated";

grant delete on table "public"."push_subscriptions" to "service_role";

grant insert on table "public"."push_subscriptions" to "service_role";

grant references on table "public"."push_subscriptions" to "service_role";

grant select on table "public"."push_subscriptions" to "service_role";

grant trigger on table "public"."push_subscriptions" to "service_role";

grant truncate on table "public"."push_subscriptions" to "service_role";

grant update on table "public"."push_subscriptions" to "service_role";

grant delete on table "public"."shop_usage" to "anon";

grant insert on table "public"."shop_usage" to "anon";

grant references on table "public"."shop_usage" to "anon";

grant select on table "public"."shop_usage" to "anon";

grant trigger on table "public"."shop_usage" to "anon";

grant truncate on table "public"."shop_usage" to "anon";

grant update on table "public"."shop_usage" to "anon";

grant delete on table "public"."shop_usage" to "authenticated";

grant insert on table "public"."shop_usage" to "authenticated";

grant references on table "public"."shop_usage" to "authenticated";

grant select on table "public"."shop_usage" to "authenticated";

grant trigger on table "public"."shop_usage" to "authenticated";

grant truncate on table "public"."shop_usage" to "authenticated";

grant update on table "public"."shop_usage" to "authenticated";

grant delete on table "public"."shop_usage" to "service_role";

grant insert on table "public"."shop_usage" to "service_role";

grant references on table "public"."shop_usage" to "service_role";

grant select on table "public"."shop_usage" to "service_role";

grant trigger on table "public"."shop_usage" to "service_role";

grant truncate on table "public"."shop_usage" to "service_role";

grant update on table "public"."shop_usage" to "service_role";

grant delete on table "public"."shop_verification_requests" to "anon";

grant insert on table "public"."shop_verification_requests" to "anon";

grant references on table "public"."shop_verification_requests" to "anon";

grant select on table "public"."shop_verification_requests" to "anon";

grant trigger on table "public"."shop_verification_requests" to "anon";

grant truncate on table "public"."shop_verification_requests" to "anon";

grant update on table "public"."shop_verification_requests" to "anon";

grant delete on table "public"."shop_verification_requests" to "authenticated";

grant insert on table "public"."shop_verification_requests" to "authenticated";

grant references on table "public"."shop_verification_requests" to "authenticated";

grant select on table "public"."shop_verification_requests" to "authenticated";

grant trigger on table "public"."shop_verification_requests" to "authenticated";

grant truncate on table "public"."shop_verification_requests" to "authenticated";

grant update on table "public"."shop_verification_requests" to "authenticated";

grant delete on table "public"."shop_verification_requests" to "service_role";

grant insert on table "public"."shop_verification_requests" to "service_role";

grant references on table "public"."shop_verification_requests" to "service_role";

grant select on table "public"."shop_verification_requests" to "service_role";

grant trigger on table "public"."shop_verification_requests" to "service_role";

grant truncate on table "public"."shop_verification_requests" to "service_role";

grant update on table "public"."shop_verification_requests" to "service_role";

grant delete on table "public"."shops" to "anon";

grant insert on table "public"."shops" to "anon";

grant references on table "public"."shops" to "anon";

grant select on table "public"."shops" to "anon";

grant trigger on table "public"."shops" to "anon";

grant truncate on table "public"."shops" to "anon";

grant update on table "public"."shops" to "anon";

grant delete on table "public"."shops" to "authenticated";

grant insert on table "public"."shops" to "authenticated";

grant references on table "public"."shops" to "authenticated";

grant select on table "public"."shops" to "authenticated";

grant trigger on table "public"."shops" to "authenticated";

grant truncate on table "public"."shops" to "authenticated";

grant update on table "public"."shops" to "authenticated";

grant delete on table "public"."shops" to "service_role";

grant insert on table "public"."shops" to "service_role";

grant references on table "public"."shops" to "service_role";

grant select on table "public"."shops" to "service_role";

grant trigger on table "public"."shops" to "service_role";

grant truncate on table "public"."shops" to "service_role";

grant update on table "public"."shops" to "service_role";

grant delete on table "public"."subscription_payments" to "anon";

grant insert on table "public"."subscription_payments" to "anon";

grant references on table "public"."subscription_payments" to "anon";

grant select on table "public"."subscription_payments" to "anon";

grant trigger on table "public"."subscription_payments" to "anon";

grant truncate on table "public"."subscription_payments" to "anon";

grant update on table "public"."subscription_payments" to "anon";

grant delete on table "public"."subscription_payments" to "authenticated";

grant insert on table "public"."subscription_payments" to "authenticated";

grant references on table "public"."subscription_payments" to "authenticated";

grant select on table "public"."subscription_payments" to "authenticated";

grant trigger on table "public"."subscription_payments" to "authenticated";

grant truncate on table "public"."subscription_payments" to "authenticated";

grant update on table "public"."subscription_payments" to "authenticated";

grant delete on table "public"."subscription_payments" to "service_role";

grant insert on table "public"."subscription_payments" to "service_role";

grant references on table "public"."subscription_payments" to "service_role";

grant select on table "public"."subscription_payments" to "service_role";

grant trigger on table "public"."subscription_payments" to "service_role";

grant truncate on table "public"."subscription_payments" to "service_role";

grant update on table "public"."subscription_payments" to "service_role";

grant delete on table "public"."subscriptions" to "anon";

grant insert on table "public"."subscriptions" to "anon";

grant references on table "public"."subscriptions" to "anon";

grant select on table "public"."subscriptions" to "anon";

grant trigger on table "public"."subscriptions" to "anon";

grant truncate on table "public"."subscriptions" to "anon";

grant update on table "public"."subscriptions" to "anon";

grant delete on table "public"."subscriptions" to "authenticated";

grant insert on table "public"."subscriptions" to "authenticated";

grant references on table "public"."subscriptions" to "authenticated";

grant select on table "public"."subscriptions" to "authenticated";

grant trigger on table "public"."subscriptions" to "authenticated";

grant truncate on table "public"."subscriptions" to "authenticated";

grant update on table "public"."subscriptions" to "authenticated";

grant delete on table "public"."subscriptions" to "service_role";

grant insert on table "public"."subscriptions" to "service_role";

grant references on table "public"."subscriptions" to "service_role";

grant select on table "public"."subscriptions" to "service_role";

grant trigger on table "public"."subscriptions" to "service_role";

grant truncate on table "public"."subscriptions" to "service_role";

grant update on table "public"."subscriptions" to "service_role";

grant delete on table "public"."team_members" to "anon";

grant insert on table "public"."team_members" to "anon";

grant references on table "public"."team_members" to "anon";

grant select on table "public"."team_members" to "anon";

grant trigger on table "public"."team_members" to "anon";

grant truncate on table "public"."team_members" to "anon";

grant update on table "public"."team_members" to "anon";

grant delete on table "public"."team_members" to "authenticated";

grant insert on table "public"."team_members" to "authenticated";

grant references on table "public"."team_members" to "authenticated";

grant select on table "public"."team_members" to "authenticated";

grant trigger on table "public"."team_members" to "authenticated";

grant truncate on table "public"."team_members" to "authenticated";

grant update on table "public"."team_members" to "authenticated";

grant delete on table "public"."team_members" to "service_role";

grant insert on table "public"."team_members" to "service_role";

grant references on table "public"."team_members" to "service_role";

grant select on table "public"."team_members" to "service_role";

grant trigger on table "public"."team_members" to "service_role";

grant truncate on table "public"."team_members" to "service_role";

grant update on table "public"."team_members" to "service_role";


  create policy "admin_audit_log_anon_block_all"
  on "public"."admin_audit_log"
  as permissive
  for all
  to public
using (false);



  create policy "allow_all"
  on "public"."admin_audit_log"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "admin_notifications_anon_block_delete"
  on "public"."admin_notifications"
  as permissive
  for delete
  to public
using (false);



  create policy "admin_notifications_anon_block_update"
  on "public"."admin_notifications"
  as permissive
  for update
  to public
using (false);



  create policy "admin_notifications_anon_block_write"
  on "public"."admin_notifications"
  as permissive
  for insert
  to public
with check (false);



  create policy "admin_notifications_anon_select"
  on "public"."admin_notifications"
  as permissive
  for select
  to public
using (true);



  create policy "allow_all"
  on "public"."customers"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_customers_all"
  on "public"."customers"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "customers_select"
  on "public"."customers"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



  create policy "allow_all"
  on "public"."email_verifications"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_email_verifications_all"
  on "public"."email_verifications"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "email_verifications_anon_block_delete"
  on "public"."email_verifications"
  as permissive
  for delete
  to public
using (false);



  create policy "email_verifications_anon_block_update_delete"
  on "public"."email_verifications"
  as permissive
  for update
  to public
using (false);



  create policy "email_verifications_anon_insert"
  on "public"."email_verifications"
  as permissive
  for insert
  to public
with check (true);



  create policy "email_verifications_anon_select"
  on "public"."email_verifications"
  as permissive
  for select
  to public
using (true);



  create policy "email_verifications_select"
  on "public"."email_verifications"
  as permissive
  for select
  to public
using ((phone IN ( SELECT team_members.phone
   FROM public.team_members
  WHERE ((team_members.shop_id = public.current_shop_id()) AND (team_members.deleted_at IS NULL)))));



  create policy "allow_all"
  on "public"."login_attempts"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "allow_all"
  on "public"."measurements"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_measurements_all"
  on "public"."measurements"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "measurements_select"
  on "public"."measurements"
  as permissive
  for select
  to public
using ((customer_id IN ( SELECT customers.id
   FROM public.customers
  WHERE ((customers.shop_id = public.current_shop_id()) AND (customers.deleted_at IS NULL)))));



  create policy "anon_order_photos_all"
  on "public"."order_photos"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "order_photos_delete_own_shop"
  on "public"."order_photos"
  as permissive
  for delete
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.team_members tm
  WHERE ((tm.shop_id = order_photos.shop_id) AND (tm.is_active = true) AND (tm.deleted_at IS NULL)))));



  create policy "order_photos_insert_own_shop"
  on "public"."order_photos"
  as permissive
  for insert
  to anon, authenticated
with check ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.team_members tm ON ((tm.shop_id = o.shop_id)))
  WHERE ((o.id = order_photos.order_id) AND (o.shop_id = order_photos.shop_id) AND (o.deleted_at IS NULL) AND (tm.is_active = true) AND (tm.deleted_at IS NULL)))));



  create policy "order_photos_select"
  on "public"."order_photos"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "order_photos_select_own_shop"
  on "public"."order_photos"
  as permissive
  for select
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.team_members tm
  WHERE ((tm.shop_id = order_photos.shop_id) AND (tm.is_active = true) AND (tm.deleted_at IS NULL)))));



  create policy "order_photos_update_own_shop"
  on "public"."order_photos"
  as permissive
  for update
  to anon, authenticated
using ((EXISTS ( SELECT 1
   FROM public.team_members tm
  WHERE ((tm.shop_id = order_photos.shop_id) AND (tm.is_active = true) AND (tm.deleted_at IS NULL)))))
with check ((EXISTS ( SELECT 1
   FROM (public.orders o
     JOIN public.team_members tm ON ((tm.shop_id = o.shop_id)))
  WHERE ((o.id = order_photos.order_id) AND (o.shop_id = order_photos.shop_id) AND (o.deleted_at IS NULL) AND (tm.is_active = true) AND (tm.deleted_at IS NULL)))));



  create policy "allow_all"
  on "public"."order_status_history"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_order_status_history_all"
  on "public"."order_status_history"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "order_status_history_select"
  on "public"."order_status_history"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "allow_all"
  on "public"."orders"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_orders_all"
  on "public"."orders"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "orders_select"
  on "public"."orders"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



  create policy "public_tracking_select"
  on "public"."orders"
  as permissive
  for select
  to public
using (((tracking_code IS NOT NULL) AND (deleted_at IS NULL)));



  create policy "allow_all"
  on "public"."payments"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_payments_all"
  on "public"."payments"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "payments_select"
  on "public"."payments"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



  create policy "allow_all"
  on "public"."plan_limits"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_push_subscriptions_all"
  on "public"."push_subscriptions"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "push_subscriptions_anon_block_delete"
  on "public"."push_subscriptions"
  as permissive
  for delete
  to public
using (false);



  create policy "push_subscriptions_anon_insert"
  on "public"."push_subscriptions"
  as permissive
  for insert
  to public
with check (true);



  create policy "push_subscriptions_anon_select"
  on "public"."push_subscriptions"
  as permissive
  for select
  to public
using (true);



  create policy "push_subscriptions_anon_update"
  on "public"."push_subscriptions"
  as permissive
  for update
  to public
using (true);



  create policy "push_subscriptions_select"
  on "public"."push_subscriptions"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "allow_all"
  on "public"."shop_usage"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_shop_usage_all"
  on "public"."shop_usage"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "shop_usage_anon_block_delete"
  on "public"."shop_usage"
  as permissive
  for delete
  to public
using (false);



  create policy "shop_usage_anon_block_update"
  on "public"."shop_usage"
  as permissive
  for update
  to public
using (false);



  create policy "shop_usage_anon_block_write"
  on "public"."shop_usage"
  as permissive
  for insert
  to public
with check (false);



  create policy "shop_usage_anon_select"
  on "public"."shop_usage"
  as permissive
  for select
  to public
using (true);



  create policy "shop_usage_select"
  on "public"."shop_usage"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "allow_all"
  on "public"."shop_verification_requests"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "shop_verification_requests_anon_block_all"
  on "public"."shop_verification_requests"
  as permissive
  for all
  to public
using (false);



  create policy "allow_all"
  on "public"."shops"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_shops_all"
  on "public"."shops"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "shops_select"
  on "public"."shops"
  as permissive
  for select
  to public
using ((id = public.current_shop_id()));



  create policy "allow_all"
  on "public"."subscription_payments"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_subscription_payments_all"
  on "public"."subscription_payments"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "subscription_payments_anon_block_delete"
  on "public"."subscription_payments"
  as permissive
  for delete
  to public
using (false);



  create policy "subscription_payments_anon_block_update"
  on "public"."subscription_payments"
  as permissive
  for update
  to public
using (false);



  create policy "subscription_payments_anon_block_write"
  on "public"."subscription_payments"
  as permissive
  for insert
  to public
with check (false);



  create policy "subscription_payments_anon_select"
  on "public"."subscription_payments"
  as permissive
  for select
  to public
using (true);



  create policy "subscription_payments_select"
  on "public"."subscription_payments"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "allow_all"
  on "public"."subscriptions"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_subscriptions_all"
  on "public"."subscriptions"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "subscriptions_anon_block_delete"
  on "public"."subscriptions"
  as permissive
  for delete
  to public
using (false);



  create policy "subscriptions_anon_block_update"
  on "public"."subscriptions"
  as permissive
  for update
  to public
using (false);



  create policy "subscriptions_anon_block_write"
  on "public"."subscriptions"
  as permissive
  for insert
  to public
with check (false);



  create policy "subscriptions_anon_select"
  on "public"."subscriptions"
  as permissive
  for select
  to public
using (true);



  create policy "subscriptions_select"
  on "public"."subscriptions"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "allow_all"
  on "public"."team_members"
  as permissive
  for all
  to public
using (true)
with check (true);



  create policy "anon_team_members_all"
  on "public"."team_members"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "team_members_select"
  on "public"."team_members"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));


CREATE TRIGGER on_customer_change AFTER INSERT OR UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.track_customer_usage();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_sync_order_customer_snapshot AFTER UPDATE OF name, phone ON public.customers FOR EACH ROW EXECUTE FUNCTION public.sync_order_customer_snapshot();

CREATE TRIGGER trg_prune_login_attempts AFTER INSERT ON public.login_attempts FOR EACH ROW EXECUTE FUNCTION public.prune_login_attempts();

CREATE TRIGGER on_order_created AFTER INSERT ON public.orders FOR EACH ROW WHEN ((new.deleted_at IS NULL)) EXECUTE FUNCTION public.track_order_usage();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_shop_created AFTER INSERT ON public.shops FOR EACH ROW EXECUTE FUNCTION public.handle_new_shop();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_subscriptions BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER sync_plan_on_activation AFTER UPDATE ON public.subscriptions FOR EACH ROW WHEN ((new.status = 'active'::text)) EXECUTE FUNCTION public.sync_shop_plan();

CREATE TRIGGER on_karigar_change AFTER INSERT OR UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.track_karigar_usage();

CREATE TRIGGER trg_team_members_refresh_usage AFTER INSERT OR DELETE OR UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.team_members_refresh_usage();

CREATE TRIGGER trg_unassign_orders_on_karigar_delete BEFORE DELETE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.unassign_orders_for_removed_karigar();

CREATE TRIGGER trg_unassign_orders_on_karigar_update BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.unassign_orders_for_removed_karigar();


