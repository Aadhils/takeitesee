-- Business Product Catalog Foundation
--
-- This creates a Business-owned catalog management surface only.
-- Products are intentionally NOT exposed to anon/public marketplace reads yet.
-- Public product launch governance and non-payment order requests will follow separately.
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain untouched.

do $$
begin
  create type public.business_product_status as enum ('draft', 'active', 'paused');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.business_product_stock_mode as enum ('in_stock', 'out_of_stock', 'made_to_order');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.business_products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  sku text,
  price numeric(12,2) not null default 0,
  currency text not null default 'INR',
  unit_label text not null default 'item',
  stock_mode public.business_product_stock_mode not null default 'in_stock',
  status public.business_product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_products_name_check check (char_length(btrim(name)) between 1 and 160),
  constraint business_products_description_check check (description is null or char_length(description) <= 5000),
  constraint business_products_sku_check check (sku is null or char_length(btrim(sku)) between 1 and 64),
  constraint business_products_price_check check (price >= 0),
  constraint business_products_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint business_products_unit_label_check check (char_length(btrim(unit_label)) between 1 and 40)
);

create index if not exists business_products_business_status_idx
  on public.business_products(business_id, status, updated_at desc);

create unique index if not exists business_products_business_sku_uidx
  on public.business_products(business_id, lower(sku))
  where sku is not null;

comment on table public.business_products is
  'Business-owned product catalog. Owner management only until separate product launch governance enables public marketplace visibility.';
comment on column public.business_products.status is
  'Owner catalog state only. active does not imply public marketplace launch approval.';

create or replace function public.touch_business_product()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.sku := nullif(upper(btrim(coalesce(new.sku, ''))), '');
  new.currency := upper(btrim(new.currency));
  new.unit_label := btrim(new.unit_label);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_business_product() from public, anon, authenticated;

drop trigger if exists business_products_touch on public.business_products;
create trigger business_products_touch
before insert or update on public.business_products
for each row execute function public.touch_business_product();

alter table public.business_products enable row level security;

revoke all on table public.business_products from public, anon, authenticated;
grant select, insert, update on table public.business_products to authenticated;
grant select, insert, update, delete on table public.business_products to service_role;

create policy business_products_owner_select
on public.business_products
for select
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_products.business_id
      and b.owner_user_id = (select auth.uid())
  )
);

create policy business_products_owner_insert
on public.business_products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_products.business_id
      and b.owner_user_id = (select auth.uid())
  )
);

create policy business_products_owner_update
on public.business_products
for update
to authenticated
using (
  exists (
    select 1
    from public.businesses b
    where b.id = business_products.business_id
      and b.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.businesses b
    where b.id = business_products.business_id
      and b.owner_user_id = (select auth.uid())
  )
);
