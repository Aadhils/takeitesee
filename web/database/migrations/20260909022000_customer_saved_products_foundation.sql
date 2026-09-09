create table if not exists public.customer_saved_products (
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  product_id uuid not null references public.business_products(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (customer_id, product_id)
);

create index if not exists customer_saved_products_product_id_idx
  on public.customer_saved_products(product_id);

alter table public.customer_saved_products enable row level security;

revoke all on table public.customer_saved_products from public, anon, authenticated;
grant select, insert, delete on table public.customer_saved_products to authenticated;
grant select, insert, update, delete on table public.customer_saved_products to service_role;

create policy customer_saved_products_owner_select
on public.customer_saved_products
for select
to authenticated
using (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = customer_id
      and cp.user_id = (select auth.uid())
  )
);

create policy customer_saved_products_owner_insert
on public.customer_saved_products
for insert
to authenticated
with check (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = customer_id
      and cp.user_id = (select auth.uid())
  )
);

create policy customer_saved_products_owner_delete
on public.customer_saved_products
for delete
to authenticated
using (
  exists (
    select 1
    from public.customer_profiles cp
    where cp.id = customer_id
      and cp.user_id = (select auth.uid())
  )
);
