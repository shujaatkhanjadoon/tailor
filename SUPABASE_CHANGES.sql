-- DarziHub requested feature support
-- Run this in Supabase Dashboard -> SQL Editor.

-- Shop branding for Business plan
alter table public.shops
  add column if not exists brand_name text,
  add column if not exists brand_color text,
  add column if not exists brand_logo_url text;

-- Payment surplus tracking
alter table public.payments
  add column if not exists applied_to_balance numeric default 0,
  add column if not exists kind text default 'order_payment'
    check (kind in ('order_payment', 'tip', 'overpayment'));

update public.payments
set applied_to_balance = amount
where applied_to_balance is null;

-- Cloudinary metadata for cross-device Business photo access.
-- Store URLs/public IDs only; image bytes remain in Cloudinary.
create table if not exists public.order_photos (
  id uuid primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  type text not null check (type in ('fabric', 'style', 'reference')),
  cloud_url text not null,
  public_id text not null,
  cloud_size_kb integer,
  size_kb integer not null default 0,
  taken_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_order_photos_shop_id on public.order_photos(shop_id);
create index if not exists idx_order_photos_order_id on public.order_photos(order_id);

-- Optional but recommended: keep usage karigar count accurate in Supabase.
create or replace function public.refresh_shop_karigar_count(target_shop_id uuid)
returns void
language plpgsql
security definer
as $$
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
$$;

create or replace function public.team_members_refresh_usage()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.refresh_shop_karigar_count(coalesce(new.shop_id, old.shop_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_team_members_refresh_usage on public.team_members;
create trigger trg_team_members_refresh_usage
after insert or update or delete on public.team_members
for each row execute function public.team_members_refresh_usage();
