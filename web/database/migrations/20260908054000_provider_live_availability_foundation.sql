-- Provider Live Availability Foundation.
--
-- This is Provider-level live work state only: Available / Busy / Offline / Paused.
-- It MUST NOT be used as a replacement for:
--   - service_availability / weekly windows / blackouts (per-service booking schedule), or
--   - future Business shop open/closed / operating-hours state.
--
-- Identity rule remains final: one account = Customer + ONE Provider identity,
-- Professional OR Business, never both after approval.
--
-- Public marketplace read exposure is intentionally NOT enabled in this foundation.
-- A later availability-aware search migration may expose only the minimum safe read model.
-- Finance/payment and recurrence/recovery surfaces are intentionally untouched.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'provider_work_mode') then
    create type public.provider_work_mode as enum ('available', 'busy', 'offline', 'paused');
  end if;
end
$$;

create table if not exists public.provider_live_availability (
  id uuid primary key default gen_random_uuid(),
  provider_type public.provider_type not null,
  professional_id uuid references public.professional_profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  work_mode public.provider_work_mode not null default 'offline'::public.provider_work_mode,
  available_until timestamptz,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_live_availability_identity_shape check (
    (provider_type = 'professional'::public.provider_type and professional_id is not null and business_id is null)
    or
    (provider_type = 'business'::public.provider_type and business_id is not null and professional_id is null)
  )
);

create unique index if not exists provider_live_availability_professional_uidx
  on public.provider_live_availability(professional_id)
  where professional_id is not null;

create unique index if not exists provider_live_availability_business_uidx
  on public.provider_live_availability(business_id)
  where business_id is not null;

create index if not exists provider_live_availability_mode_idx
  on public.provider_live_availability(work_mode, updated_at desc);

comment on table public.provider_live_availability is
  'Provider-level live work state. Separate from per-service schedule availability and Business shop open/closed state.';
comment on column public.provider_live_availability.available_until is
  'Optional expiry hint for Available/Busy state. Consumers must treat an expired live state as Offline.';

create or replace function public.maintain_provider_live_availability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
    new.provider_type is distinct from old.provider_type
    or new.professional_id is distinct from old.professional_id
    or new.business_id is distinct from old.business_id
  ) then
    raise exception 'Provider live availability identity is immutable.';
  end if;

  if new.work_mode in ('offline'::public.provider_work_mode, 'paused'::public.provider_work_mode) then
    new.available_until := null;
  end if;

  if tg_op = 'INSERT'
    or new.work_mode is distinct from old.work_mode
    or new.available_until is distinct from old.available_until then
    new.status_changed_at := now();
  end if;

  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  end if;
  new.updated_at := now();

  return new;
end;
$$;

revoke all on function public.maintain_provider_live_availability() from public, anon, authenticated;

drop trigger if exists provider_live_availability_maintain on public.provider_live_availability;
create trigger provider_live_availability_maintain
before insert or update on public.provider_live_availability
for each row execute function public.maintain_provider_live_availability();

alter table public.provider_live_availability enable row level security;

revoke all on table public.provider_live_availability from public, anon, authenticated;
grant select, insert, update on table public.provider_live_availability to authenticated;

create policy provider_live_availability_owner_read
on public.provider_live_availability
for select
to authenticated
using (
  (
    provider_type = 'professional'::public.provider_type
    and exists (
      select 1
      from public.professional_profiles p
      where p.id = provider_live_availability.professional_id
        and p.user_id = (select auth.uid())
    )
  )
  or
  (
    provider_type = 'business'::public.provider_type
    and exists (
      select 1
      from public.businesses b
      where b.id = provider_live_availability.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
);

create policy provider_live_availability_owner_insert
on public.provider_live_availability
for insert
to authenticated
with check (
  (
    provider_type = 'professional'::public.provider_type
    and professional_id is not null
    and business_id is null
    and exists (
      select 1
      from public.professional_profiles p
      where p.id = provider_live_availability.professional_id
        and p.user_id = (select auth.uid())
    )
  )
  or
  (
    provider_type = 'business'::public.provider_type
    and business_id is not null
    and professional_id is null
    and exists (
      select 1
      from public.businesses b
      where b.id = provider_live_availability.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
);

create policy provider_live_availability_owner_update
on public.provider_live_availability
for update
to authenticated
using (
  (
    provider_type = 'professional'::public.provider_type
    and exists (
      select 1
      from public.professional_profiles p
      where p.id = provider_live_availability.professional_id
        and p.user_id = (select auth.uid())
    )
  )
  or
  (
    provider_type = 'business'::public.provider_type
    and exists (
      select 1
      from public.businesses b
      where b.id = provider_live_availability.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
)
with check (
  (
    provider_type = 'professional'::public.provider_type
    and exists (
      select 1
      from public.professional_profiles p
      where p.id = provider_live_availability.professional_id
        and p.user_id = (select auth.uid())
    )
  )
  or
  (
    provider_type = 'business'::public.provider_type
    and exists (
      select 1
      from public.businesses b
      where b.id = provider_live_availability.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
);
