-- Business Product Non-Payment Order Request Lifecycle
--
-- This migration adds a single-product Customer -> Business order request workflow.
-- It intentionally does NOT add cart, payment, Cashfree, refund, payout, settlement,
-- reconciliation, recovery, recurrence, inventory decrement, or receivable state.

create type public.business_product_order_status as enum (
  'requested',
  'accepted',
  'declined',
  'fulfilled',
  'cancelled'
);

create table public.business_product_orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.business_products(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  customer_user_id uuid not null references public.users(id) on delete restrict,
  product_revision integer not null,
  product_name_snapshot text not null,
  business_name_snapshot text not null,
  customer_name_snapshot text not null,
  unit_price_snapshot numeric(12,2) not null,
  currency_snapshot text not null,
  unit_label_snapshot text not null,
  quantity integer not null,
  customer_note text,
  business_note text,
  status public.business_product_order_status not null default 'requested',
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_product_orders_revision_check check (product_revision >= 1),
  constraint business_product_orders_product_name_check check (char_length(product_name_snapshot) between 1 and 160),
  constraint business_product_orders_business_name_check check (char_length(business_name_snapshot) between 1 and 160),
  constraint business_product_orders_customer_name_check check (char_length(customer_name_snapshot) between 1 and 160),
  constraint business_product_orders_price_check check (unit_price_snapshot >= 0 and unit_price_snapshot <= 9999999999.99),
  constraint business_product_orders_currency_check check (currency_snapshot ~ '^[A-Z]{3}$'),
  constraint business_product_orders_unit_label_check check (char_length(unit_label_snapshot) between 1 and 40),
  constraint business_product_orders_quantity_check check (quantity between 1 and 999),
  constraint business_product_orders_customer_note_check check (customer_note is null or char_length(customer_note) <= 1200),
  constraint business_product_orders_business_note_check check (business_note is null or char_length(business_note) <= 1200)
);

create index business_product_orders_product_created_idx
  on public.business_product_orders(product_id, created_at desc);
create index business_product_orders_business_status_created_idx
  on public.business_product_orders(business_id, status, created_at desc);
create index business_product_orders_customer_created_idx
  on public.business_product_orders(customer_user_id, created_at desc);

create table public.business_product_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.business_product_orders(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('customer','business','system')),
  event_type text not null check (event_type in ('requested','accepted','declined','fulfilled','cancelled')),
  note text,
  created_at timestamptz not null default now(),
  constraint business_product_order_events_note_check check (note is null or char_length(note) <= 1200)
);

create index business_product_order_events_order_created_idx
  on public.business_product_order_events(order_id, created_at);
create index business_product_order_events_actor_user_idx
  on public.business_product_order_events(actor_user_id)
  where actor_user_id is not null;

comment on table public.business_product_orders is
  'Non-payment single-product order requests between Customers and Business Providers. Product and identity display fields are snapshotted at request time; no payment, settlement, inventory decrement or Cashfree state is stored here.';
comment on column public.business_product_orders.unit_price_snapshot is
  'Informational catalog price snapshot only. This is not a TakeItEsee payment, charge, settlement or receivable.';

create or replace function private.business_product_order_actor_can_read(
  target_business_id uuid,
  target_customer_user_id uuid,
  target_actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target_actor_user_id is not null
    and (
      target_customer_user_id = target_actor_user_id
      or exists (
        select 1
        from public.businesses b
        where b.id = target_business_id
          and b.owner_user_id = target_actor_user_id
      )
    );
$$;

revoke all on function private.business_product_order_actor_can_read(uuid,uuid,uuid) from public;
grant execute on function private.business_product_order_actor_can_read(uuid,uuid,uuid) to authenticated, service_role;

alter table public.business_product_orders enable row level security;
alter table public.business_product_order_events enable row level security;

revoke all on table public.business_product_orders from public, anon, authenticated;
revoke all on table public.business_product_order_events from public, anon, authenticated;
grant select on table public.business_product_orders to authenticated;
grant select on table public.business_product_order_events to authenticated;
grant select, insert, update, delete on table public.business_product_orders to service_role;
grant select, insert, update, delete on table public.business_product_order_events to service_role;

create policy business_product_orders_participant_read
on public.business_product_orders
for select
to authenticated
using (
  private.business_product_order_actor_can_read(
    business_id,
    customer_user_id,
    (select auth.uid())
  )
);

create policy business_product_order_events_participant_read
on public.business_product_order_events
for select
to authenticated
using (
  exists (
    select 1
    from public.business_product_orders o
    where o.id = business_product_order_events.order_id
  )
);

create or replace function public.create_business_product_order_request(
  target_product_id uuid,
  target_customer_user_id uuid,
  target_quantity integer,
  target_customer_note text default null
)
returns public.business_product_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_row public.business_products%rowtype;
  business_row public.businesses%rowtype;
  customer_row public.users%rowtype;
  order_row public.business_product_orders%rowtype;
  note_value text := nullif(btrim(coalesce(target_customer_note, '')), '');
begin
  if target_customer_user_id is null then
    raise exception 'Customer identity is required.';
  end if;
  if target_quantity is null or target_quantity < 1 or target_quantity > 999 then
    raise exception 'Quantity must be between 1 and 999.';
  end if;
  if note_value is not null and char_length(note_value) > 1200 then
    raise exception 'Order note must be 1200 characters or fewer.';
  end if;

  select * into customer_row
  from public.users u
  where u.id = target_customer_user_id;
  if not found then
    raise exception 'Customer account was not found.';
  end if;

  select * into product_row
  from public.business_products p
  where p.id = target_product_id
  for update;
  if not found then
    raise exception 'Product was not found.';
  end if;

  select * into business_row
  from public.businesses b
  where b.id = product_row.business_id;
  if not found then
    raise exception 'Business for this product was not found.';
  end if;

  if business_row.owner_user_id = target_customer_user_id then
    raise exception 'You cannot request an order from your own Business.';
  end if;
  if exists (
    select 1 from public.professional_profiles p
    where p.user_id = business_row.owner_user_id
  ) then
    raise exception 'Provider identity conflict detected.';
  end if;
  if product_row.status <> 'active'::public.business_product_status then
    raise exception 'This product is not currently open for order requests.';
  end if;
  if product_row.stock_mode = 'out_of_stock'::public.business_product_stock_mode then
    raise exception 'This product is currently out of stock.';
  end if;
  if not private.business_product_current_revision_is_approved(
    product_row.id,
    product_row.business_id,
    product_row.review_revision
  ) then
    raise exception 'The current product revision is not approved for public orders.';
  end if;
  if not private.provider_owner_is_verified('business', null, product_row.business_id)
     or not private.provider_profile_is_complete('business', null, product_row.business_id)
     or not private.provider_marketplace_disclosure_is_complete('business', null, product_row.business_id)
     or not private.provider_trust_allows_marketplace('business', null, product_row.business_id)
  then
    raise exception 'This Business is not currently eligible for marketplace orders.';
  end if;

  insert into public.business_product_orders(
    product_id,
    business_id,
    customer_user_id,
    product_revision,
    product_name_snapshot,
    business_name_snapshot,
    customer_name_snapshot,
    unit_price_snapshot,
    currency_snapshot,
    unit_label_snapshot,
    quantity,
    customer_note,
    status
  ) values (
    product_row.id,
    product_row.business_id,
    target_customer_user_id,
    product_row.review_revision,
    product_row.name,
    coalesce(nullif(btrim(business_row.name), ''), 'Business'),
    coalesce(nullif(btrim(customer_row.name), ''), 'Customer'),
    product_row.price,
    product_row.currency,
    product_row.unit_label,
    target_quantity,
    note_value,
    'requested'
  ) returning * into order_row;

  insert into public.business_product_order_events(
    order_id,
    actor_user_id,
    actor_type,
    event_type,
    note
  ) values (
    order_row.id,
    target_customer_user_id,
    'customer',
    'requested',
    note_value
  );

  return order_row;
end;
$$;

create or replace function public.cancel_business_product_order_request(
  target_order_id uuid,
  target_customer_user_id uuid
)
returns public.business_product_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.business_product_orders%rowtype;
begin
  select * into order_row
  from public.business_product_orders o
  where o.id = target_order_id
    and o.customer_user_id = target_customer_user_id
  for update;
  if not found then
    raise exception 'Order request was not found.';
  end if;
  if order_row.status not in (
    'requested'::public.business_product_order_status,
    'accepted'::public.business_product_order_status
  ) then
    raise exception 'This order can no longer be cancelled.';
  end if;

  update public.business_product_orders
  set status = 'cancelled',
      status_changed_at = now(),
      updated_at = now()
  where id = order_row.id
  returning * into order_row;

  insert into public.business_product_order_events(
    order_id,
    actor_user_id,
    actor_type,
    event_type,
    note
  ) values (
    order_row.id,
    target_customer_user_id,
    'customer',
    'cancelled',
    'Order request cancelled by the Customer.'
  );

  return order_row;
end;
$$;

create or replace function public.transition_business_product_order(
  target_order_id uuid,
  target_business_owner_user_id uuid,
  target_action text,
  target_note text default null
)
returns public.business_product_orders
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.business_product_orders%rowtype;
  note_value text := nullif(btrim(coalesce(target_note, '')), '');
  next_status public.business_product_order_status;
begin
  if target_action not in ('accept','decline','fulfill') then
    raise exception 'Choose accept, decline, or fulfill.';
  end if;
  if note_value is not null and char_length(note_value) > 1200 then
    raise exception 'Business note must be 1200 characters or fewer.';
  end if;
  if target_action = 'decline' and (note_value is null or char_length(note_value) < 3) then
    raise exception 'A decline reason is required.';
  end if;

  select * into order_row
  from public.business_product_orders o
  where o.id = target_order_id
  for update;
  if not found then
    raise exception 'Order request was not found.';
  end if;

  if not exists (
    select 1
    from public.businesses b
    where b.id = order_row.business_id
      and b.owner_user_id = target_business_owner_user_id
  ) then
    raise exception 'Business ownership could not be verified.';
  end if;
  if exists (
    select 1 from public.professional_profiles p
    where p.user_id = target_business_owner_user_id
  ) then
    raise exception 'Provider identity conflict detected.';
  end if;

  if target_action = 'accept' then
    if order_row.status <> 'requested'::public.business_product_order_status then
      raise exception 'Only requested orders can be accepted.';
    end if;
    next_status := 'accepted';
  elsif target_action = 'decline' then
    if order_row.status <> 'requested'::public.business_product_order_status then
      raise exception 'Only requested orders can be declined.';
    end if;
    next_status := 'declined';
  else
    if order_row.status <> 'accepted'::public.business_product_order_status then
      raise exception 'Only accepted orders can be marked fulfilled.';
    end if;
    next_status := 'fulfilled';
  end if;

  update public.business_product_orders
  set status = next_status,
      business_note = case when note_value is not null then note_value else business_note end,
      status_changed_at = now(),
      updated_at = now()
  where id = order_row.id
  returning * into order_row;

  insert into public.business_product_order_events(
    order_id,
    actor_user_id,
    actor_type,
    event_type,
    note
  ) values (
    order_row.id,
    target_business_owner_user_id,
    'business',
    next_status::text,
    note_value
  );

  return order_row;
end;
$$;

revoke all on function public.create_business_product_order_request(uuid,uuid,integer,text) from public, anon, authenticated;
revoke all on function public.cancel_business_product_order_request(uuid,uuid) from public, anon, authenticated;
revoke all on function public.transition_business_product_order(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_business_product_order_request(uuid,uuid,integer,text) to service_role;
grant execute on function public.cancel_business_product_order_request(uuid,uuid) to service_role;
grant execute on function public.transition_business_product_order(uuid,uuid,text,text) to service_role;
