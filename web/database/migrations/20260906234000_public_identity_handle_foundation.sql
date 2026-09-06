-- Public identity handle foundation for Customer + one Provider identity.
-- Finance/payment/refund/payout/settlement/reconciliation/recovery remain untouched.

create table if not exists public.identity_handles (
  handle text primary key,
  identity_type text not null check (identity_type in ('customer','professional','business')),
  identity_id uuid not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  constraint identity_handle_canonical_shape check (
    handle = lower(handle)
    and char_length(handle) between 3 and 30
    and handle ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
    and handle not like '%--%'
  ),
  constraint identity_handle_retirement_state check (
    (is_current and retired_at is null)
    or (not is_current and retired_at is not null)
  )
);

create unique index if not exists identity_handles_one_current_per_identity
  on public.identity_handles(identity_type,identity_id)
  where is_current;

create index if not exists identity_handles_identity_history_idx
  on public.identity_handles(identity_type,identity_id,created_at desc);

alter table public.identity_handles enable row level security;

revoke all on table public.identity_handles from public,anon,authenticated;
grant select (handle,identity_type,identity_id,is_current,created_at,retired_at)
  on public.identity_handles to anon,authenticated;

drop policy if exists identity_handles_public_read on public.identity_handles;
create policy identity_handles_public_read
on public.identity_handles for select
to anon,authenticated
using (true);

create or replace function public.normalize_identity_handle(raw_handle text)
returns text
language sql
immutable
security invoker
set search_path=''
as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(lower(trim(leading '@' from coalesce(raw_handle,''))), '[ _]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;

revoke all on function public.normalize_identity_handle(text) from public;
grant execute on function public.normalize_identity_handle(text) to anon,authenticated,service_role;

create or replace function public.is_reserved_identity_handle(candidate text)
returns boolean
language sql
immutable
security invoker
set search_path=''
as $$
  select candidate = any(array[
    'about','account','admin','api','app','auth','billing','blog','business','businesses',
    'careers','checkout','contact','dashboard','docs','help','home','jobs','legal','login',
    'logout','marketplace','me','messages','new','notifications','privacy','professional',
    'professionals','provider','providers','ref','register','search','security','settings',
    'signup','signin','support','takeitesee','terms','user','users','verify','www'
  ]::text[]);
$$;

revoke all on function public.is_reserved_identity_handle(text) from public;
grant execute on function public.is_reserved_identity_handle(text) to anon,authenticated,service_role;

create or replace function public.set_my_identity_handle(target_context text,requested_handle text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_handle text;
  resolved_type text;
  resolved_identity_id uuid;
  existing_current text;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if target_context not in ('customer','provider') then
    raise exception 'Invalid identity context.';
  end if;

  normalized_handle := public.normalize_identity_handle(requested_handle);

  if char_length(normalized_handle) < 3 or char_length(normalized_handle) > 30
     or normalized_handle !~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$'
     or normalized_handle like '%--%' then
    raise exception 'Handle must be 3-30 characters using letters, numbers, and single hyphens only.';
  end if;

  if public.is_reserved_identity_handle(normalized_handle) then
    raise exception 'This handle is reserved.';
  end if;

  if target_context='customer' then
    resolved_type := 'customer';
    select cp.id into resolved_identity_id
    from public.customer_profiles cp
    where cp.user_id=current_user_id
    limit 1;
  else
    select p.id into resolved_identity_id
    from public.professional_profiles p
    where p.user_id=current_user_id
    limit 1;

    if resolved_identity_id is not null then
      resolved_type := 'professional';
    else
      select b.id into resolved_identity_id
      from public.businesses b
      where b.owner_user_id=current_user_id
      limit 1;
      if resolved_identity_id is not null then
        resolved_type := 'business';
      end if;
    end if;
  end if;

  if resolved_identity_id is null then
    raise exception 'Identity profile is required before claiming a handle.';
  end if;

  select ih.handle into existing_current
  from public.identity_handles ih
  where ih.identity_type=resolved_type
    and ih.identity_id=resolved_identity_id
    and ih.is_current
  limit 1;

  if existing_current=normalized_handle then
    return jsonb_build_object(
      'handle',normalized_handle,
      'identity_type',resolved_type,
      'identity_id',resolved_identity_id,
      'changed',false
    );
  end if;

  if exists(select 1 from public.identity_handles ih where ih.handle=normalized_handle) then
    raise exception 'This handle is not available.';
  end if;

  update public.identity_handles
  set is_current=false,retired_at=now()
  where identity_type=resolved_type
    and identity_id=resolved_identity_id
    and is_current;

  insert into public.identity_handles(handle,identity_type,identity_id,is_current)
  values (normalized_handle,resolved_type,resolved_identity_id,true);

  return jsonb_build_object(
    'handle',normalized_handle,
    'previous_handle',existing_current,
    'identity_type',resolved_type,
    'identity_id',resolved_identity_id,
    'changed',true
  );
exception
  when unique_violation then
    raise exception 'This handle is not available.';
end;
$$;

revoke all on function public.set_my_identity_handle(text,text) from public,anon;
grant execute on function public.set_my_identity_handle(text,text) to authenticated,service_role;

create or replace function public.resolve_public_identity_handle(raw_handle text)
returns table(
  requested_handle text,
  canonical_handle text,
  identity_type text,
  identity_id uuid,
  is_canonical boolean
)
language sql
stable
security invoker
set search_path=''
as $$
  with requested as (
    select public.normalize_identity_handle(raw_handle) as handle
  ), matched as (
    select ih.handle,ih.identity_type,ih.identity_id,ih.is_current
    from public.identity_handles ih
    join requested r on r.handle=ih.handle
    limit 1
  )
  select
    m.handle,
    current_handle.handle,
    m.identity_type,
    m.identity_id,
    m.is_current
  from matched m
  join public.identity_handles current_handle
    on current_handle.identity_type=m.identity_type
   and current_handle.identity_id=m.identity_id
   and current_handle.is_current;
$$;

revoke all on function public.resolve_public_identity_handle(text) from public;
grant execute on function public.resolve_public_identity_handle(text) to anon,authenticated,service_role;
