create table if not exists public.customer_saved_services (
  customer_id uuid not null references public.customer_profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (customer_id, service_id)
);

create index if not exists customer_saved_services_service_id_idx
  on public.customer_saved_services(service_id);

alter table public.customer_saved_services enable row level security;

revoke all on table public.customer_saved_services from public, anon, authenticated;
grant select, insert, delete on table public.customer_saved_services to authenticated;
grant select, insert, update, delete on table public.customer_saved_services to service_role;

create policy customer_saved_services_owner_select
on public.customer_saved_services
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

create policy customer_saved_services_owner_insert
on public.customer_saved_services
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

create policy customer_saved_services_owner_delete
on public.customer_saved_services
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
