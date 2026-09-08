-- Marketplace precise geolocation foundation.
--
-- Layering rules:
-- - platform_locations remains the coarse country/state/city/zone rollout scope.
-- - service_geo_locations stores private precise fixed/base service points.
-- - provider_live_locations stores private, expiring Provider live points.
-- - service_fulfillment_modes declares how each service can be fulfilled.
-- - raw coordinates are NEVER granted to anon/authenticated marketplace readers.
-- - a server-only, service_role RPC returns derived distance + matched mode only.
--
-- Provider identity finality remains authoritative: one account = Customer + ONE
-- Provider identity, Professional OR Business, never both after approval.
-- Finance/payment and recurrence/recovery surfaces are intentionally untouched.

create extension if not exists postgis with schema extensions;

do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='marketplace_service_fulfillment_mode'
  ) then
    create type public.marketplace_service_fulfillment_mode as enum ('at_provider','at_customer','remote');
  end if;

  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace
    where n.nspname='public' and t.typname='service_geo_location_role'
  ) then
    create type public.service_geo_location_role as enum ('service_site','mobile_base');
  end if;
end
$$;

create table if not exists public.service_fulfillment_modes (
  service_id uuid not null references public.services(id) on delete cascade,
  mode public.marketplace_service_fulfillment_mode not null,
  max_travel_distance_meters integer,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (service_id, mode),
  constraint service_fulfillment_modes_travel_distance_check check (
    max_travel_distance_meters is null
    or (
      mode = 'at_customer'::public.marketplace_service_fulfillment_mode
      and max_travel_distance_meters between 100 and 500000
    )
  )
);

comment on table public.service_fulfillment_modes is
  'Physical/remote fulfillment capabilities for a marketplace service. Separate from customer requirement onsite/remote wording and from booking schedule availability.';

create table if not exists public.service_geo_locations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  platform_location_id uuid references public.platform_locations(id) on delete set null,
  role public.service_geo_location_role not null,
  label text,
  point extensions.geography(Point,4326) not null,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_geo_locations_service_role_idx
  on public.service_geo_locations(service_id, role, active);
create index if not exists service_geo_locations_point_gix
  on public.service_geo_locations using gist(point);
create unique index if not exists service_geo_locations_primary_role_uidx
  on public.service_geo_locations(service_id, role)
  where is_primary = true and active = true;

comment on table public.service_geo_locations is
  'Private precise service points. service_site is a customer-facing fixed place; mobile_base is a non-live fallback origin for at-customer services.';
comment on column public.service_geo_locations.platform_location_id is
  'Optional link back to the existing coarse rollout location hierarchy; this does not replace platform_locations.';

create table if not exists public.provider_live_locations (
  id uuid primary key default gen_random_uuid(),
  provider_type public.provider_type not null,
  professional_id uuid references public.professional_profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  point extensions.geography(Point,4326) not null,
  accuracy_meters numeric(10,2),
  captured_at timestamptz not null,
  expires_at timestamptz,
  matching_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_live_locations_identity_shape check (
    (provider_type='professional'::public.provider_type and professional_id is not null and business_id is null)
    or
    (provider_type='business'::public.provider_type and business_id is not null and professional_id is null)
  ),
  constraint provider_live_locations_accuracy_check check (
    accuracy_meters is null or accuracy_meters between 0 and 50000
  ),
  constraint provider_live_locations_expiry_check check (
    expires_at is null or expires_at > captured_at
  )
);

create unique index if not exists provider_live_locations_professional_uidx
  on public.provider_live_locations(professional_id)
  where professional_id is not null;
create unique index if not exists provider_live_locations_business_uidx
  on public.provider_live_locations(business_id)
  where business_id is not null;
create index if not exists provider_live_locations_matching_expiry_idx
  on public.provider_live_locations(matching_enabled, expires_at);
create index if not exists provider_live_locations_point_gix
  on public.provider_live_locations using gist(point);

comment on table public.provider_live_locations is
  'Private, expiring Provider live location used for at-customer nearby matching. Raw coordinates are never a public marketplace read surface.';
comment on column public.provider_live_locations.matching_enabled is
  'Explicit Provider consent for using the stored live point in marketplace matching. Search also requires a non-expired expires_at.';

create or replace function public.touch_service_fulfillment_mode()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_service_fulfillment_mode() from public, anon, authenticated;

drop trigger if exists service_fulfillment_modes_touch on public.service_fulfillment_modes;
create trigger service_fulfillment_modes_touch
before update on public.service_fulfillment_modes
for each row execute function public.touch_service_fulfillment_mode();

create or replace function public.maintain_service_geo_location()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE' and new.service_id is distinct from old.service_id then
    raise exception 'Service geo location service identity is immutable.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.maintain_service_geo_location() from public, anon, authenticated;

drop trigger if exists service_geo_locations_maintain on public.service_geo_locations;
create trigger service_geo_locations_maintain
before insert or update on public.service_geo_locations
for each row execute function public.maintain_service_geo_location();

create or replace function public.maintain_provider_live_location()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE' then
    if new.provider_type is distinct from old.provider_type
      or new.professional_id is distinct from old.professional_id
      or new.business_id is distinct from old.business_id then
      raise exception 'Provider live location identity is immutable.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.maintain_provider_live_location() from public, anon, authenticated;

drop trigger if exists provider_live_locations_maintain on public.provider_live_locations;
create trigger provider_live_locations_maintain
before insert or update on public.provider_live_locations
for each row execute function public.maintain_provider_live_location();

alter table public.service_fulfillment_modes enable row level security;
alter table public.service_geo_locations enable row level security;
alter table public.provider_live_locations enable row level security;

revoke all on table public.service_fulfillment_modes from public, anon, authenticated;
revoke all on table public.service_geo_locations from public, anon, authenticated;
revoke all on table public.provider_live_locations from public, anon, authenticated;

grant select, insert, update, delete on table public.service_fulfillment_modes to authenticated;
grant select, insert, update, delete on table public.service_geo_locations to authenticated;
grant select, insert, update, delete on table public.provider_live_locations to authenticated;

grant select on table public.service_fulfillment_modes to service_role;
grant select on table public.service_geo_locations to service_role;
grant select on table public.provider_live_locations to service_role;

create policy service_fulfillment_modes_owner_all
on public.service_fulfillment_modes
for all
to authenticated
using (
  exists (
    select 1 from public.services s
    where s.id=service_fulfillment_modes.service_id
      and (
        (s.provider_type='professional'::public.provider_type and exists (
          select 1 from public.professional_profiles p
          where p.id=s.professional_id and p.user_id=(select auth.uid())
        ))
        or
        (s.provider_type='business'::public.provider_type and exists (
          select 1 from public.businesses b
          where b.id=s.business_id and b.owner_user_id=(select auth.uid())
        ))
      )
  )
)
with check (
  exists (
    select 1 from public.services s
    where s.id=service_fulfillment_modes.service_id
      and (
        (s.provider_type='professional'::public.provider_type and exists (
          select 1 from public.professional_profiles p
          where p.id=s.professional_id and p.user_id=(select auth.uid())
        ))
        or
        (s.provider_type='business'::public.provider_type and exists (
          select 1 from public.businesses b
          where b.id=s.business_id and b.owner_user_id=(select auth.uid())
        ))
      )
  )
);

create policy service_geo_locations_owner_all
on public.service_geo_locations
for all
to authenticated
using (
  exists (
    select 1 from public.services s
    where s.id=service_geo_locations.service_id
      and (
        (s.provider_type='professional'::public.provider_type and exists (
          select 1 from public.professional_profiles p
          where p.id=s.professional_id and p.user_id=(select auth.uid())
        ))
        or
        (s.provider_type='business'::public.provider_type and exists (
          select 1 from public.businesses b
          where b.id=s.business_id and b.owner_user_id=(select auth.uid())
        ))
      )
  )
)
with check (
  exists (
    select 1 from public.services s
    where s.id=service_geo_locations.service_id
      and (
        (s.provider_type='professional'::public.provider_type and exists (
          select 1 from public.professional_profiles p
          where p.id=s.professional_id and p.user_id=(select auth.uid())
        ))
        or
        (s.provider_type='business'::public.provider_type and exists (
          select 1 from public.businesses b
          where b.id=s.business_id and b.owner_user_id=(select auth.uid())
        ))
      )
  )
);

create policy provider_live_locations_owner_all
on public.provider_live_locations
for all
to authenticated
using (
  (
    provider_type='professional'::public.provider_type
    and exists (
      select 1 from public.professional_profiles p
      where p.id=provider_live_locations.professional_id and p.user_id=(select auth.uid())
    )
  )
  or
  (
    provider_type='business'::public.provider_type
    and exists (
      select 1 from public.businesses b
      where b.id=provider_live_locations.business_id and b.owner_user_id=(select auth.uid())
    )
  )
)
with check (
  (
    provider_type='professional'::public.provider_type
    and professional_id is not null and business_id is null
    and exists (
      select 1 from public.professional_profiles p
      where p.id=provider_live_locations.professional_id and p.user_id=(select auth.uid())
    )
  )
  or
  (
    provider_type='business'::public.provider_type
    and business_id is not null and professional_id is null
    and exists (
      select 1 from public.businesses b
      where b.id=provider_live_locations.business_id and b.owner_user_id=(select auth.uid())
    )
  )
);

-- Server-only distance resolver. The service-role caller supplies only service ids that
-- have already passed the normal public marketplace launch/trust/verification gates.
-- No raw coordinates are returned.
create or replace function public.get_marketplace_geo_distances(
  target_service_ids uuid[],
  origin_lat double precision,
  origin_long double precision
)
returns table (
  service_id uuid,
  distance_meters double precision,
  match_mode public.marketplace_service_fulfillment_mode,
  geo_source text
)
language sql
security invoker
set search_path=''
as $$
  with origin as (
    select extensions.st_point(origin_long, origin_lat)::extensions.geography as point
    where origin_lat between -90 and 90
      and origin_long between -180 and 180
      and coalesce(cardinality(target_service_ids),0) between 1 and 2000
  ),
  valid_live as (
    select pl.provider_type, pl.professional_id, pl.business_id, pl.point
    from public.provider_live_locations pl
    where pl.matching_enabled=true
      and pl.expires_at is not null
      and pl.expires_at > now()
  ),
  candidates as (
    select
      m.service_id,
      extensions.st_distance(g.point,o.point) as distance_meters,
      m.mode as match_mode,
      'service_site'::text as geo_source,
      1 as source_priority,
      m.max_travel_distance_meters
    from public.service_fulfillment_modes m
    join public.service_geo_locations g
      on g.service_id=m.service_id
     and g.role='service_site'::public.service_geo_location_role
     and g.active=true
    cross join origin o
    where m.active=true
      and m.mode='at_provider'::public.marketplace_service_fulfillment_mode
      and m.service_id=any(target_service_ids)

    union all

    select
      m.service_id,
      extensions.st_distance(pl.point,o.point) as distance_meters,
      m.mode as match_mode,
      'provider_live'::text as geo_source,
      0 as source_priority,
      m.max_travel_distance_meters
    from public.service_fulfillment_modes m
    join public.services s on s.id=m.service_id
    join valid_live pl
      on pl.provider_type=s.provider_type
     and (
       (s.provider_type='professional'::public.provider_type and pl.professional_id=s.professional_id and pl.business_id is null)
       or
       (s.provider_type='business'::public.provider_type and pl.business_id=s.business_id and pl.professional_id is null)
     )
    cross join origin o
    where m.active=true
      and m.mode='at_customer'::public.marketplace_service_fulfillment_mode
      and m.service_id=any(target_service_ids)

    union all

    select
      m.service_id,
      extensions.st_distance(g.point,o.point) as distance_meters,
      m.mode as match_mode,
      'mobile_base'::text as geo_source,
      2 as source_priority,
      m.max_travel_distance_meters
    from public.service_fulfillment_modes m
    join public.services s on s.id=m.service_id
    join public.service_geo_locations g
      on g.service_id=m.service_id
     and g.role='mobile_base'::public.service_geo_location_role
     and g.active=true
    cross join origin o
    where m.active=true
      and m.mode='at_customer'::public.marketplace_service_fulfillment_mode
      and m.service_id=any(target_service_ids)
      and not exists (
        select 1 from valid_live pl
        where pl.provider_type=s.provider_type
          and (
            (s.provider_type='professional'::public.provider_type and pl.professional_id=s.professional_id and pl.business_id is null)
            or
            (s.provider_type='business'::public.provider_type and pl.business_id=s.business_id and pl.professional_id is null)
          )
      )
  ),
  eligible as (
    select * from candidates c
    where c.max_travel_distance_meters is null
       or c.match_mode <> 'at_customer'::public.marketplace_service_fulfillment_mode
       or c.distance_meters <= c.max_travel_distance_meters
  )
  select distinct on (e.service_id)
    e.service_id,
    e.distance_meters,
    e.match_mode,
    e.geo_source
  from eligible e
  order by e.service_id, e.distance_meters asc, e.source_priority asc;
$$;

revoke all on function public.get_marketplace_geo_distances(uuid[],double precision,double precision)
  from public, anon, authenticated;
grant execute on function public.get_marketplace_geo_distances(uuid[],double precision,double precision)
  to service_role;
