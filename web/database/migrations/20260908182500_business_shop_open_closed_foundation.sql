-- Business Shop Open/Closed Foundation
--
-- Add a manual Business storefront operating signal that is deliberately
-- separate from Provider live work mode and per-service booking schedules.
-- Missing state is interpreted by application code as Closed.
-- This does not cancel/block bookings or product orders and does not activate
-- payment, Cashfree, refund, payout, settlement, reconciliation, recovery,
-- recurrence, or inventory behavior.

create type public.business_shop_state as enum ('open','closed');

create table public.business_shop_status (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  shop_state public.business_shop_state not null default 'closed',
  status_changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_shop_status is
  'Manual Business storefront Shop Open/Closed signal. Separate from Provider live work mode and service booking schedules.';
comment on column public.business_shop_status.shop_state is
  'Manual storefront operating signal only; it does not cancel or block existing bookings/orders and is not a payment state.';

create or replace function private.touch_business_shop_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.shop_state is distinct from old.shop_state then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.touch_business_shop_status() from public, anon, authenticated;
grant execute on function private.touch_business_shop_status() to service_role;

create trigger business_shop_status_touch
before update on public.business_shop_status
for each row execute function private.touch_business_shop_status();

alter table public.business_shop_status enable row level security;
revoke all on table public.business_shop_status from public, anon, authenticated;
grant select on table public.business_shop_status to authenticated;
grant insert (business_id, shop_state) on table public.business_shop_status to authenticated;
grant update (shop_state) on table public.business_shop_status to authenticated;
grant select, insert, update, delete on table public.business_shop_status to service_role;

create policy business_shop_status_owner_select
on public.business_shop_status
for select to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id=business_shop_status.business_id
      and b.owner_user_id=(select auth.uid())
  )
);

create policy business_shop_status_owner_insert
on public.business_shop_status
for insert to authenticated
with check (
  exists (
    select 1 from public.businesses b
    where b.id=business_shop_status.business_id
      and b.owner_user_id=(select auth.uid())
  )
);

create policy business_shop_status_owner_update
on public.business_shop_status
for update to authenticated
using (
  exists (
    select 1 from public.businesses b
    where b.id=business_shop_status.business_id
      and b.owner_user_id=(select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses b
    where b.id=business_shop_status.business_id
      and b.owner_user_id=(select auth.uid())
  )
);
