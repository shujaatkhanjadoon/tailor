drop trigger if exists "on_customer_change" on "public"."customers";

drop trigger if exists "set_updated_at" on "public"."customers";

drop trigger if exists "trg_sync_order_customer_snapshot" on "public"."customers";

drop trigger if exists "trg_prune_login_attempts" on "public"."login_attempts";

drop trigger if exists "on_order_created" on "public"."orders";

drop trigger if exists "set_updated_at" on "public"."orders";

drop trigger if exists "on_shop_created" on "public"."shops";

drop trigger if exists "set_updated_at" on "public"."shops";

drop trigger if exists "set_updated_at_subscriptions" on "public"."subscriptions";

drop trigger if exists "sync_plan_on_activation" on "public"."subscriptions";

drop trigger if exists "on_karigar_change" on "public"."team_members";

drop trigger if exists "trg_team_members_refresh_usage" on "public"."team_members";

drop trigger if exists "trg_unassign_orders_on_karigar_delete" on "public"."team_members";

drop trigger if exists "trg_unassign_orders_on_karigar_update" on "public"."team_members";

drop policy "shops_select" on "public"."shops";

drop policy "team_members_select" on "public"."team_members";

drop policy "customers_select" on "public"."customers";

drop policy "email_verifications_select" on "public"."email_verifications";

drop policy "measurements_select" on "public"."measurements";

drop policy "order_photos_delete_own_shop" on "public"."order_photos";

drop policy "order_photos_insert_own_shop" on "public"."order_photos";

drop policy "order_photos_select" on "public"."order_photos";

drop policy "order_photos_select_own_shop" on "public"."order_photos";

drop policy "order_photos_update_own_shop" on "public"."order_photos";

drop policy "order_status_history_select" on "public"."order_status_history";

drop policy "orders_select" on "public"."orders";

drop policy "payments_select" on "public"."payments";

drop policy "push_subscriptions_select" on "public"."push_subscriptions";

drop policy "shop_usage_select" on "public"."shop_usage";

drop policy "subscription_payments_select" on "public"."subscription_payments";

drop policy "subscriptions_select" on "public"."subscriptions";

alter table "public"."admin_audit_log" drop constraint "admin_audit_log_shop_id_fkey";

alter table "public"."coupon_redemptions" drop constraint "coupon_redemptions_coupon_id_fkey";

alter table "public"."coupon_redemptions" drop constraint "coupon_redemptions_shop_id_fkey";

alter table "public"."coupon_redemptions" drop constraint "coupon_redemptions_subscription_payment_id_fkey";

alter table "public"."customers" drop constraint "customers_shop_id_fkey";

alter table "public"."measurements" drop constraint "measurements_customer_id_fkey";

alter table "public"."measurements" drop constraint "measurements_shop_id_fkey";

alter table "public"."order_photos" drop constraint "order_photos_order_id_fkey";

alter table "public"."order_photos" drop constraint "order_photos_shop_id_fkey";

alter table "public"."order_status_history" drop constraint "order_status_history_changed_by_fkey";

alter table "public"."order_status_history" drop constraint "order_status_history_order_id_fkey";

alter table "public"."orders" drop constraint "orders_assigned_to_fkey";

alter table "public"."orders" drop constraint "orders_customer_id_fkey";

alter table "public"."orders" drop constraint "orders_measurement_id_fkey";

alter table "public"."orders" drop constraint "orders_shop_id_fkey";

alter table "public"."payments" drop constraint "payments_order_id_fkey";

alter table "public"."payments" drop constraint "payments_recorded_by_fkey";

alter table "public"."payments" drop constraint "payments_shop_id_fkey";

alter table "public"."shop_usage" drop constraint "shop_usage_shop_id_fkey";

alter table "public"."shop_verification_requests" drop constraint "shop_verification_requests_shop_id_fkey";

alter table "public"."subscription_payments" drop constraint "subscription_payments_shop_id_fkey";

alter table "public"."subscription_payments" drop constraint "subscription_payments_subscription_id_fkey";

alter table "public"."subscriptions" drop constraint "subscriptions_shop_id_fkey";

alter table "public"."team_members" drop constraint "team_members_shop_id_fkey";

drop index if exists "public"."idx_customers_name_ilike";

alter table "public"."admin_audit_log" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."customers" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."email_verifications" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."login_attempts" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."measurements" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."order_status_history" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."orders" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."payments" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."shop_usage" add column "id" uuid default gen_random_uuid();

alter table "public"."shop_verification_requests" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."shops" add column "deleted_at" timestamp with time zone;

alter table "public"."shops" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."subscription_payments" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."subscriptions" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."team_members" alter column "id" set default extensions.uuid_generate_v4();

CREATE INDEX idx_email_verifications_phone_pending ON public.email_verifications USING btree (phone, verified_at) WHERE (verified_at IS NULL);

CREATE INDEX idx_orders_assigned_to_active ON public.orders USING btree (shop_id, assigned_to) WHERE (deleted_at IS NULL);

CREATE INDEX idx_orders_shop_id_created_at_status ON public.orders USING btree (shop_id, created_at DESC, status);

CREATE INDEX idx_orders_shop_id_customer ON public.orders USING btree (shop_id, customer_id, status);

CREATE INDEX idx_orders_shop_id_garment_type ON public.orders USING btree (shop_id, garment_type);

CREATE INDEX idx_payments_shop_id_paid_at_method ON public.payments USING btree (shop_id, paid_at DESC, method);

CREATE INDEX idx_sub_payments_shop_id_status ON public.subscription_payments USING btree (shop_id, status);

CREATE INDEX idx_subscription_payments_subscription ON public.subscription_payments USING btree (subscription_id);

CREATE INDEX idx_subscriptions_shop_id_status ON public.subscriptions USING btree (shop_id, status);

CREATE INDEX idx_subscriptions_status_expires ON public.subscriptions USING btree (status, expires_at);

CREATE UNIQUE INDEX unique_shop_order_number ON public.orders USING btree (shop_id, order_number);

CREATE INDEX idx_customers_name_ilike ON public.customers USING gin (name public.gin_trgm_ops);

alter table "public"."orders" add constraint "unique_shop_order_number" UNIQUE using index "unique_shop_order_number";

alter table "public"."admin_audit_log" add constraint "admin_audit_log_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE SET NULL not valid;

alter table "public"."admin_audit_log" validate constraint "admin_audit_log_shop_id_fkey";

alter table "public"."coupon_redemptions" add constraint "coupon_redemptions_coupon_id_fkey" FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE not valid;

alter table "public"."coupon_redemptions" validate constraint "coupon_redemptions_coupon_id_fkey";

alter table "public"."coupon_redemptions" add constraint "coupon_redemptions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."coupon_redemptions" validate constraint "coupon_redemptions_shop_id_fkey";

alter table "public"."coupon_redemptions" add constraint "coupon_redemptions_subscription_payment_id_fkey" FOREIGN KEY (subscription_payment_id) REFERENCES public.subscription_payments(id) ON DELETE SET NULL not valid;

alter table "public"."coupon_redemptions" validate constraint "coupon_redemptions_subscription_payment_id_fkey";

alter table "public"."customers" add constraint "customers_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."customers" validate constraint "customers_shop_id_fkey";

alter table "public"."measurements" add constraint "measurements_customer_id_fkey" FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE not valid;

alter table "public"."measurements" validate constraint "measurements_customer_id_fkey";

alter table "public"."measurements" add constraint "measurements_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."measurements" validate constraint "measurements_shop_id_fkey";

alter table "public"."order_photos" add constraint "order_photos_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."order_photos" validate constraint "order_photos_order_id_fkey";

alter table "public"."order_photos" add constraint "order_photos_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."order_photos" validate constraint "order_photos_shop_id_fkey";

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

alter table "public"."orders" add constraint "orders_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."orders" validate constraint "orders_shop_id_fkey";

alter table "public"."payments" add constraint "payments_order_id_fkey" FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_order_id_fkey";

alter table "public"."payments" add constraint "payments_recorded_by_fkey" FOREIGN KEY (recorded_by) REFERENCES public.team_members(id) not valid;

alter table "public"."payments" validate constraint "payments_recorded_by_fkey";

alter table "public"."payments" add constraint "payments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."payments" validate constraint "payments_shop_id_fkey";

alter table "public"."shop_usage" add constraint "shop_usage_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) not valid;

alter table "public"."shop_usage" validate constraint "shop_usage_shop_id_fkey";

alter table "public"."shop_verification_requests" add constraint "shop_verification_requests_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."shop_verification_requests" validate constraint "shop_verification_requests_shop_id_fkey";

alter table "public"."subscription_payments" add constraint "subscription_payments_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) not valid;

alter table "public"."subscription_payments" validate constraint "subscription_payments_shop_id_fkey";

alter table "public"."subscription_payments" add constraint "subscription_payments_subscription_id_fkey" FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) not valid;

alter table "public"."subscription_payments" validate constraint "subscription_payments_subscription_id_fkey";

alter table "public"."subscriptions" add constraint "subscriptions_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."subscriptions" validate constraint "subscriptions_shop_id_fkey";

alter table "public"."team_members" add constraint "team_members_shop_id_fkey" FOREIGN KEY (shop_id) REFERENCES public.shops(id) ON DELETE CASCADE not valid;

alter table "public"."team_members" validate constraint "team_members_shop_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_shop_and_related(p_shop_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order_ids UUID[];
  v_result JSONB;
BEGIN
  -- Collect all order IDs for this shop
  SELECT ARRAY_AGG(id) INTO v_order_ids
  FROM orders
  WHERE shop_id = p_shop_id;

  -- Delete order_status_history (by order_id)
  IF v_order_ids IS NOT NULL THEN
    DELETE FROM order_status_history WHERE order_id = ANY(v_order_ids);
  END IF;

  -- Delete order_photos
  DELETE FROM order_photos WHERE shop_id = p_shop_id;

  -- Delete payments
  DELETE FROM payments WHERE shop_id = p_shop_id;

  -- Delete measurements
  DELETE FROM measurements WHERE shop_id = p_shop_id;

  -- Delete orders
  DELETE FROM orders WHERE shop_id = p_shop_id;

  -- Delete customers
  DELETE FROM customers WHERE shop_id = p_shop_id;

  -- Delete team_members
  DELETE FROM team_members WHERE shop_id = p_shop_id;

  -- Delete subscription_payments
  DELETE FROM subscription_payments WHERE shop_id = p_shop_id;

  -- Delete subscriptions
  DELETE FROM subscriptions WHERE shop_id = p_shop_id;

  -- Delete shop_usage
  DELETE FROM shop_usage WHERE shop_id = p_shop_id;

  -- Delete shop_verification_requests
  DELETE FROM shop_verification_requests WHERE shop_id = p_shop_id;

  -- Finally delete the shop itself
  DELETE FROM shops WHERE id = p_shop_id;

  v_result := jsonb_build_object('success', true, 'shop_id', p_shop_id);
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  v_result := jsonb_build_object('success', false, 'error', SQLERRM);
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalc_customers_total(p_shop_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*)::integer INTO cnt
  FROM customers
  WHERE shop_id = p_shop_id
    AND deleted_at IS NULL;
  RETURN cnt;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalc_karigar_count(p_shop_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*)::integer INTO cnt
  FROM team_members
  WHERE shop_id = p_shop_id
    AND role = 'karigar'
    AND is_active = true
    AND deleted_at IS NULL;
  RETURN cnt;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalc_orders_this_month(p_shop_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  cnt integer;
BEGIN
  SELECT COUNT(*)::integer INTO cnt
  FROM orders
  WHERE shop_id = p_shop_id
    AND deleted_at IS NULL
    AND created_at >= date_trunc('month', now());
  RETURN cnt;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_shop_usage(p_shop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM upsert_shop_usage(p_shop_id);
  UPDATE shop_usage
  SET orders_this_month = recalc_orders_this_month(p_shop_id),
      customers_total   = recalc_customers_total(p_shop_id),
      karigar_count     = recalc_karigar_count(p_shop_id),
      month_year        = to_char(now(), 'YYYY-MM'),
      updated_at        = now()
  WHERE shop_id = p_shop_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_customers_refresh_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM refresh_shop_usage(OLD.shop_id);
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_orders_refresh_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM refresh_shop_usage(OLD.shop_id);
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.trg_team_refresh_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM refresh_shop_usage(NEW.shop_id);
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM refresh_shop_usage(OLD.shop_id);
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.upsert_shop_usage(p_shop_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO shop_usage (shop_id, orders_this_month, customers_total, karigar_count, storage_used_kb, month_year, updated_at)
  VALUES (p_shop_id, 0, 0, 0, 0, to_char(now(), 'YYYY-MM'), now())
  ON CONFLICT (shop_id) DO NOTHING;
END;
$function$
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

CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(p_coupon_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE coupons
  SET used_count = used_count + 1
  WHERE id = p_coupon_id
    AND (max_uses IS NULL OR used_count < max_uses)
    AND is_active = true
  RETURNING used_count INTO updated_count;

  RETURN FOUND;
END;
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


  create policy "allow_all"
  on "public"."admin_audit_log"
  as permissive
  for all
  to public
using (true)
with check (true);



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



  create policy "customers_delete"
  on "public"."customers"
  as permissive
  for delete
  to public
using ((shop_id = public.current_shop_id()));



  create policy "customers_insert"
  on "public"."customers"
  as permissive
  for insert
  to public
with check ((shop_id = public.current_shop_id()));



  create policy "customers_update"
  on "public"."customers"
  as permissive
  for update
  to public
using ((shop_id = public.current_shop_id()))
with check ((shop_id = public.current_shop_id()));



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



  create policy "measurements_delete"
  on "public"."measurements"
  as permissive
  for delete
  to public
using ((shop_id = public.current_shop_id()));



  create policy "measurements_insert"
  on "public"."measurements"
  as permissive
  for insert
  to public
with check ((shop_id = public.current_shop_id()));



  create policy "measurements_update"
  on "public"."measurements"
  as permissive
  for update
  to public
using ((shop_id = public.current_shop_id()))
with check ((shop_id = public.current_shop_id()));



  create policy "anon_order_photos_all"
  on "public"."order_photos"
  as permissive
  for all
  to anon
using (true)
with check (true);



  create policy "order_photos_insert"
  on "public"."order_photos"
  as permissive
  for insert
  to public
with check ((shop_id = public.current_shop_id()));



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



  create policy "order_status_history_insert"
  on "public"."order_status_history"
  as permissive
  for insert
  to public
with check ((shop_id = public.current_shop_id()));



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



  create policy "orders_delete"
  on "public"."orders"
  as permissive
  for delete
  to public
using ((shop_id = public.current_shop_id()));



  create policy "orders_insert"
  on "public"."orders"
  as permissive
  for insert
  to public
with check ((shop_id = public.current_shop_id()));



  create policy "orders_update"
  on "public"."orders"
  as permissive
  for update
  to public
using ((shop_id = public.current_shop_id()))
with check ((shop_id = public.current_shop_id()));



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



  create policy "payments_delete"
  on "public"."payments"
  as permissive
  for delete
  to public
using ((shop_id = public.current_shop_id()));



  create policy "payments_insert"
  on "public"."payments"
  as permissive
  for insert
  to public
with check ((shop_id = public.current_shop_id()));



  create policy "payments_update"
  on "public"."payments"
  as permissive
  for update
  to public
using ((shop_id = public.current_shop_id()))
with check ((shop_id = public.current_shop_id()));



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



  create policy "allow_all"
  on "public"."shop_verification_requests"
  as permissive
  for all
  to public
using (true)
with check (true);



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



  create policy "team_members_insert"
  on "public"."team_members"
  as permissive
  for insert
  to public
with check ((shop_id = public.current_shop_id()));



  create policy "customers_select"
  on "public"."customers"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



  create policy "email_verifications_select"
  on "public"."email_verifications"
  as permissive
  for select
  to public
using ((phone IN ( SELECT team_members.phone
   FROM public.team_members
  WHERE ((team_members.shop_id = public.current_shop_id()) AND (team_members.deleted_at IS NULL)))));



  create policy "measurements_select"
  on "public"."measurements"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



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
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



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



  create policy "order_status_history_select"
  on "public"."order_status_history"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "orders_select"
  on "public"."orders"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



  create policy "payments_select"
  on "public"."payments"
  as permissive
  for select
  to public
using (((shop_id = public.current_shop_id()) AND (deleted_at IS NULL)));



  create policy "push_subscriptions_select"
  on "public"."push_subscriptions"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "shop_usage_select"
  on "public"."shop_usage"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "subscription_payments_select"
  on "public"."subscription_payments"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));



  create policy "subscriptions_select"
  on "public"."subscriptions"
  as permissive
  for select
  to public
using ((shop_id = public.current_shop_id()));


CREATE TRIGGER customers_usage_trigger AFTER INSERT OR DELETE OR UPDATE OF deleted_at ON public.customers FOR EACH ROW EXECUTE FUNCTION public.trg_customers_refresh_usage();

CREATE TRIGGER orders_usage_trigger AFTER INSERT OR DELETE OR UPDATE OF deleted_at, created_at ON public.orders FOR EACH ROW EXECUTE FUNCTION public.trg_orders_refresh_usage();

CREATE TRIGGER team_usage_trigger AFTER INSERT OR DELETE OR UPDATE OF is_active, deleted_at ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.trg_team_refresh_usage();

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


