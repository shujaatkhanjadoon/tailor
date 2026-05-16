-- Run in Supabase SQL Editor before deploying address/email/payment updates.

alter table public.shops
  add column if not exists state_province text,
  add column if not exists address_line text,
  add column if not exists postal_code text;

alter table public.shop_verification_requests
  add column if not exists state_province text,
  add column if not exists address_line text,
  add column if not exists postal_code text;

alter table public.payments
  add column if not exists applied_to_balance numeric default 0,
  add column if not exists kind text default 'order_payment';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payments_kind_check'
  ) then
    alter table public.payments
      add constraint payments_kind_check
      check (kind in ('order_payment', 'tip', 'overpayment'));
  end if;
end $$;

create index if not exists idx_payments_order_active
  on public.payments (order_id)
  where deleted_at is null;

create index if not exists idx_orders_shop_active
  on public.orders (shop_id, status)
  where deleted_at is null;
