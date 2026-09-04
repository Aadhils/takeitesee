-- Product: Professional multi-skill identity foundation.
--
-- Preserve one verified master professional profile per user while allowing that
-- professional to describe multiple talents / professional roles underneath it.
-- Subscription, paid ranking boosts, job applications, portfolio media and finance
-- behavior are intentionally outside this migration.

create table if not exists public.professional_roles (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  title text not null,
  summary text,
  experience_years integer,
  service_bookings_enabled boolean not null default true,
  freelance_enabled boolean not null default false,
  part_time_enabled boolean not null default false,
  full_time_enabled boolean not null default false,
  contract_enabled boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_roles_title_length_check
    check (char_length(btrim(title)) between 2 and 120),
  constraint professional_roles_summary_length_check
    check (summary is null or char_length(summary) <= 1200),
  constraint professional_roles_experience_years_check
    check (experience_years is null or experience_years between 0 and 80),
  constraint professional_roles_display_order_check
    check (display_order between 0 and 9999)
);

create unique index if not exists professional_roles_professional_title_unique_idx
  on public.professional_roles (professional_id, lower(btrim(title)));

create index if not exists professional_roles_professional_active_order_idx
  on public.professional_roles (professional_id, active, display_order, created_at);

alter table public.professional_roles enable row level security;

revoke all on table public.professional_roles from public, anon, authenticated;
grant select on table public.professional_roles to anon, authenticated;
grant insert, update, delete on table public.professional_roles to authenticated;
grant select, insert, update, delete on table public.professional_roles to service_role;

drop policy if exists professional_roles_public_read on public.professional_roles;
create policy professional_roles_public_read
on public.professional_roles
for select
to anon, authenticated
using (
  active
  and exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.verified = true
  )
);

drop policy if exists professional_roles_owner_read on public.professional_roles;
create policy professional_roles_owner_read
on public.professional_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
);

drop policy if exists professional_roles_owner_insert on public.professional_roles;
create policy professional_roles_owner_insert
on public.professional_roles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
);

drop policy if exists professional_roles_owner_update on public.professional_roles;
create policy professional_roles_owner_update
on public.professional_roles
for update
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
);

drop policy if exists professional_roles_owner_delete on public.professional_roles;
create policy professional_roles_owner_delete
on public.professional_roles
for delete
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
);

comment on table public.professional_roles is
  'Professional-owned child roles/talents under one master verified professional profile.';
comment on column public.professional_roles.service_bookings_enabled is
  'Professional currently accepts customer service-booking opportunities for this role.';
comment on column public.professional_roles.freelance_enabled is
  'Professional is open to freelance opportunities for this role.';
comment on column public.professional_roles.part_time_enabled is
  'Professional is open to part-time opportunities for this role.';
comment on column public.professional_roles.full_time_enabled is
  'Professional is open to full-time opportunities for this role.';
comment on column public.professional_roles.contract_enabled is
  'Professional is open to contract opportunities for this role.';
