-- Business Product Public Launch Governance
--
-- Product catalog ownership remains separate from marketplace publication.
-- A product becomes public only when its CURRENT review revision is approved and
-- the owning Business still passes the canonical verification/profile/disclosure/trust gates.
-- Review-sensitive catalog edits increment review_revision and automatically withdraw
-- any stale pending launch request.
--
-- No cart, order, payment, Cashfree, refund, payout, settlement, reconciliation,
-- recovery or recurrence behavior is introduced here.

alter table public.business_products
  add column if not exists review_revision integer not null default 1;

alter table public.business_products
  drop constraint if exists business_products_review_revision_check;
alter table public.business_products
  add constraint business_products_review_revision_check check (review_revision >= 1);

create table if not exists public.business_product_launch_requests (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.business_products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  product_revision integer not null,
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected','withdrawn')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_product_launch_requests_revision_check check (product_revision >= 1),
  constraint business_product_launch_requests_note_check check (review_note is null or char_length(review_note) <= 1200)
);

create unique index if not exists business_product_launch_requests_one_pending_idx
  on public.business_product_launch_requests(product_id)
  where status = 'pending';
create index if not exists business_product_launch_requests_product_revision_idx
  on public.business_product_launch_requests(product_id, product_revision, status, created_at desc);
create index if not exists business_product_launch_requests_status_created_idx
  on public.business_product_launch_requests(status, created_at desc);
create index if not exists business_product_launch_requests_business_created_idx
  on public.business_product_launch_requests(business_id, created_at desc);
create index if not exists business_product_launch_requests_applicant_created_idx
  on public.business_product_launch_requests(applicant_user_id, created_at desc);
create index if not exists business_product_launch_requests_reviewed_by_idx
  on public.business_product_launch_requests(reviewed_by)
  where reviewed_by is not null;

create table if not exists public.business_product_launch_events (
  id uuid primary key default gen_random_uuid(),
  launch_request_id uuid not null references public.business_product_launch_requests(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('provider','super_admin','system')),
  event_type text not null check (event_type in ('submitted','withdrawn','approved','changes_requested','rejected','stale_revision')),
  note text,
  created_at timestamptz not null default now(),
  constraint business_product_launch_events_note_check check (note is null or char_length(note) <= 1200)
);

create index if not exists business_product_launch_events_request_created_idx
  on public.business_product_launch_events(launch_request_id, created_at);
create index if not exists business_product_launch_events_actor_user_idx
  on public.business_product_launch_events(actor_user_id)
  where actor_user_id is not null;

comment on table public.business_product_launch_requests is
  'Revision-bound platform review requests controlling whether a Business product may appear publicly.';
comment on column public.business_products.review_revision is
  'Increments when review-sensitive product content changes. Public launch approval must match the current revision.';

-- Harden direct authenticated updates so review_revision and ownership/timestamps cannot be manipulated.
revoke update on table public.business_products from authenticated;
grant update (name, description, sku, price, currency, unit_label, stock_mode, status)
  on public.business_products to authenticated;

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

  if tg_op = 'INSERT' then
    new.review_revision := 1;
  elsif new.name is distinct from old.name
     or new.description is distinct from old.description
     or new.sku is distinct from old.sku
     or new.price is distinct from old.price
     or new.currency is distinct from old.currency
     or new.unit_label is distinct from old.unit_label then
    new.review_revision := old.review_revision + 1;
  else
    new.review_revision := old.review_revision;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_business_product() from public, anon, authenticated;

create or replace function private.withdraw_stale_business_product_launch_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.review_revision is distinct from old.review_revision then
    with stale as (
      update public.business_product_launch_requests
      set status = 'withdrawn',
          review_note = 'Product changed after launch submission. Submit the current revision for review.',
          reviewed_by = null,
          reviewed_at = null,
          updated_at = now()
      where product_id = new.id
        and status = 'pending'
        and product_revision <> new.review_revision
      returning id
    )
    insert into public.business_product_launch_events(launch_request_id, actor_user_id, actor_type, event_type, note)
    select id, null, 'system', 'stale_revision', 'Pending launch review withdrawn because review-sensitive product content changed.'
    from stale;
  end if;
  return new;
end;
$$;

revoke all on function private.withdraw_stale_business_product_launch_requests() from public, anon, authenticated;

drop trigger if exists business_products_withdraw_stale_launch on public.business_products;
create trigger business_products_withdraw_stale_launch
after update on public.business_products
for each row execute function private.withdraw_stale_business_product_launch_requests();

alter table public.business_product_launch_requests enable row level security;
alter table public.business_product_launch_events enable row level security;

revoke all on table public.business_product_launch_requests from public, anon, authenticated;
revoke all on table public.business_product_launch_events from public, anon, authenticated;
grant select on table public.business_product_launch_requests to authenticated;
grant select on table public.business_product_launch_events to authenticated;
grant select, insert, update, delete on table public.business_product_launch_requests to service_role;
grant select, insert, update, delete on table public.business_product_launch_events to service_role;

drop policy if exists business_product_launch_requests_private_read on public.business_product_launch_requests;
create policy business_product_launch_requests_private_read
on public.business_product_launch_requests
for select
to authenticated
using (
  applicant_user_id = (select auth.uid())
  or private.is_super_admin()
);

drop policy if exists business_product_launch_events_private_read on public.business_product_launch_events;
create policy business_product_launch_events_private_read
on public.business_product_launch_events
for select
to authenticated
using (
  exists (
    select 1
    from public.business_product_launch_requests r
    where r.id = business_product_launch_events.launch_request_id
      and (
        r.applicant_user_id = (select auth.uid())
        or private.is_super_admin()
      )
  )
);

-- Atomic server-only workflow functions. Route handlers authenticate the caller first;
-- these SECURITY INVOKER functions are executable only by service_role and independently
-- validate Business ownership/current revision relationships.
create or replace function public.submit_business_product_launch_request(
  target_product_id uuid,
  target_business_id uuid,
  target_applicant_user_id uuid
)
returns public.business_product_launch_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_row public.business_products%rowtype;
  request_row public.business_product_launch_requests%rowtype;
begin
  if not exists (
    select 1 from public.businesses b
    where b.id = target_business_id and b.owner_user_id = target_applicant_user_id
  ) then
    raise exception 'Business ownership could not be verified.';
  end if;
  if exists (select 1 from public.professional_profiles p where p.user_id = target_applicant_user_id) then
    raise exception 'Provider identity conflict detected.';
  end if;

  select * into product_row
  from public.business_products p
  where p.id = target_product_id and p.business_id = target_business_id
  for update;
  if not found then raise exception 'Product was not found or is not owned by this Business.'; end if;
  if product_row.status <> 'active'::public.business_product_status then
    raise exception 'Set the product catalog status to Active before requesting public launch.';
  end if;
  if exists (
    select 1 from public.business_product_launch_requests r
    where r.product_id = product_row.id and r.status = 'pending'
  ) then
    raise exception 'A launch request is already awaiting review for this product.';
  end if;
  if exists (
    select 1 from public.business_product_launch_requests r
    where r.product_id = product_row.id
      and r.product_revision = product_row.review_revision
      and r.status = 'approved'
  ) then
    raise exception 'The current product revision is already approved for public launch.';
  end if;

  insert into public.business_product_launch_requests(
    product_id, business_id, applicant_user_id, product_revision, status
  ) values (
    product_row.id, product_row.business_id, target_applicant_user_id, product_row.review_revision, 'pending'
  ) returning * into request_row;

  insert into public.business_product_launch_events(
    launch_request_id, actor_user_id, actor_type, event_type, note
  ) values (
    request_row.id, target_applicant_user_id, 'provider', 'submitted',
    'Current product revision submitted for public launch review.'
  );

  return request_row;
end;
$$;

create or replace function public.withdraw_business_product_launch_request(
  target_product_id uuid,
  target_business_id uuid,
  target_applicant_user_id uuid
)
returns public.business_product_launch_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_row public.business_product_launch_requests%rowtype;
begin
  if not exists (
    select 1 from public.businesses b
    where b.id = target_business_id and b.owner_user_id = target_applicant_user_id
  ) then
    raise exception 'Business ownership could not be verified.';
  end if;

  select * into request_row
  from public.business_product_launch_requests r
  where r.product_id = target_product_id
    and r.business_id = target_business_id
    and r.applicant_user_id = target_applicant_user_id
    and r.status = 'pending'
  order by r.created_at desc
  limit 1
  for update;
  if not found then raise exception 'Pending product launch request was not found.'; end if;

  update public.business_product_launch_requests
  set status = 'withdrawn', updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.business_product_launch_events(
    launch_request_id, actor_user_id, actor_type, event_type, note
  ) values (
    request_row.id, target_applicant_user_id, 'provider', 'withdrawn',
    'Product launch request withdrawn by the Business owner.'
  );

  return request_row;
end;
$$;

create or replace function public.review_business_product_launch_request(
  target_request_id uuid,
  target_reviewer_user_id uuid,
  target_decision text,
  target_review_note text default null
)
returns public.business_product_launch_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  request_row public.business_product_launch_requests%rowtype;
  product_row public.business_products%rowtype;
  note_value text := nullif(btrim(coalesce(target_review_note, '')), '');
  next_status text;
begin
  if target_decision not in ('approve','changes_requested','reject') then
    raise exception 'Choose approve, changes_requested, or reject.';
  end if;
  if target_decision <> 'approve' and (note_value is null or char_length(note_value) < 3) then
    raise exception 'A review reason is required.';
  end if;
  if note_value is not null and char_length(note_value) > 1200 then
    raise exception 'Review note must be 1200 characters or fewer.';
  end if;

  select * into request_row
  from public.business_product_launch_requests r
  where r.id = target_request_id and r.status = 'pending'
  for update;
  if not found then raise exception 'Pending product launch request was not found.'; end if;
  if request_row.applicant_user_id = target_reviewer_user_id then
    raise exception 'You cannot review your own product launch request.';
  end if;

  select * into product_row
  from public.business_products p
  where p.id = request_row.product_id and p.business_id = request_row.business_id;
  if not found then raise exception 'Product for this launch request was not found.'; end if;
  if request_row.product_revision <> product_row.review_revision then
    raise exception 'This launch request is stale because the product content changed.';
  end if;

  next_status := case target_decision
    when 'approve' then 'approved'
    when 'changes_requested' then 'changes_requested'
    else 'rejected'
  end;

  update public.business_product_launch_requests
  set status = next_status,
      review_note = note_value,
      reviewed_by = target_reviewer_user_id,
      reviewed_at = now(),
      updated_at = now()
  where id = request_row.id
  returning * into request_row;

  insert into public.business_product_launch_events(
    launch_request_id, actor_user_id, actor_type, event_type, note
  ) values (
    request_row.id,
    target_reviewer_user_id,
    'super_admin',
    next_status,
    coalesce(note_value, case when next_status = 'approved' then 'Current product revision approved for public launch.' else null end)
  );

  return request_row;
end;
$$;

revoke all on function public.submit_business_product_launch_request(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.withdraw_business_product_launch_request(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.review_business_product_launch_request(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.submit_business_product_launch_request(uuid,uuid,uuid) to service_role;
grant execute on function public.withdraw_business_product_launch_request(uuid,uuid,uuid) to service_role;
grant execute on function public.review_business_product_launch_request(uuid,uuid,text,text) to service_role;

-- Private approval helper lets public product RLS inspect only a boolean without exposing
-- internal launch-request rows to anon/authenticated callers.
create or replace function private.business_product_current_revision_is_approved(
  target_product_id uuid,
  target_business_id uuid,
  target_revision integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_product_launch_requests r
    where r.product_id = target_product_id
      and r.business_id = target_business_id
      and r.product_revision = target_revision
      and r.status = 'approved'
  );
$$;

revoke all on function private.business_product_current_revision_is_approved(uuid,uuid,integer) from public;
grant execute on function private.business_product_current_revision_is_approved(uuid,uuid,integer) to anon, authenticated, service_role;

-- Public product reads are intentionally column-limited. SKU, review revision and internal timestamps
-- are not exposed through the anon Data API surface.
revoke all on table public.business_products from anon;
grant select (id, business_id, name, description, price, currency, unit_label, stock_mode)
  on public.business_products to anon;

drop policy if exists business_products_public_current_revision_read on public.business_products;
create policy business_products_public_current_revision_read
on public.business_products
for select
to anon
using (
  status = 'active'::public.business_product_status
  and private.business_product_current_revision_is_approved(id, business_id, review_revision)
  and private.provider_owner_is_verified('business', null, business_id)
  and private.provider_profile_is_complete('business', null, business_id)
  and private.provider_marketplace_disclosure_is_complete('business', null, business_id)
  and private.provider_trust_allows_marketplace('business', null, business_id)
);
