-- Fix public booking availability reads after Provider base-read privacy hardening.
--
-- The existing availability SELECT policies apply TO public and combine:
--   1) active-service visibility, and
--   2) authenticated Provider-owner visibility through professional_profiles.user_id /
--      businesses.owner_user_id.
--
-- Anonymous callers are intentionally not granted those private ownership columns. PostgreSQL
-- still validates the full PUBLIC policy expression, so the owner branch can raise
-- "permission denied for table professional_profiles" before the public booking endpoint can
-- return availability for an otherwise launch-ready Service.
--
-- Split the read union by role so anonymous requests never touch owner-only columns while
-- authenticated Provider owners retain paused/draft Service schedule visibility. Provider write
-- policies are intentionally unchanged.
--
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery are untouched.
-- Recurrence/recovery remains frozen.

-- service_availability

drop policy if exists availability_read on public.service_availability;
drop policy if exists availability_anon_read_active on public.service_availability;
drop policy if exists availability_authenticated_read on public.service_availability;

create policy availability_anon_read_active
on public.service_availability
for select
to anon
using (
  exists (
    select 1
    from public.services s
    where s.id = service_availability.service_id
      and s.status = 'active'::public.service_status
  )
);

create policy availability_authenticated_read
on public.service_availability
for select
to authenticated
using (
  exists (
    select 1
    from public.services s
    where s.id = service_availability.service_id
      and s.status = 'active'::public.service_status
  )
  or exists (
    select 1
    from public.services s
    left join public.professional_profiles pp on pp.id = s.professional_id
    left join public.businesses b on b.id = s.business_id
    where s.id = service_availability.service_id
      and (
        pp.user_id = (select auth.uid())
        or b.owner_user_id = (select auth.uid())
      )
  )
);

-- service_availability_windows

drop policy if exists availability_windows_read on public.service_availability_windows;
drop policy if exists availability_windows_anon_read_active on public.service_availability_windows;
drop policy if exists availability_windows_authenticated_read on public.service_availability_windows;

create policy availability_windows_anon_read_active
on public.service_availability_windows
for select
to anon
using (
  exists (
    select 1
    from public.services s
    where s.id = service_availability_windows.service_id
      and s.status = 'active'::public.service_status
  )
);

create policy availability_windows_authenticated_read
on public.service_availability_windows
for select
to authenticated
using (
  exists (
    select 1
    from public.services s
    where s.id = service_availability_windows.service_id
      and s.status = 'active'::public.service_status
  )
  or exists (
    select 1
    from public.services s
    left join public.professional_profiles pp on pp.id = s.professional_id
    left join public.businesses b on b.id = s.business_id
    where s.id = service_availability_windows.service_id
      and (
        pp.user_id = (select auth.uid())
        or b.owner_user_id = (select auth.uid())
      )
  )
);

-- service_availability_blackouts

drop policy if exists availability_blackouts_read on public.service_availability_blackouts;
drop policy if exists availability_blackouts_anon_read_active on public.service_availability_blackouts;
drop policy if exists availability_blackouts_authenticated_read on public.service_availability_blackouts;

create policy availability_blackouts_anon_read_active
on public.service_availability_blackouts
for select
to anon
using (
  exists (
    select 1
    from public.services s
    where s.id = service_availability_blackouts.service_id
      and s.status = 'active'::public.service_status
  )
);

create policy availability_blackouts_authenticated_read
on public.service_availability_blackouts
for select
to authenticated
using (
  exists (
    select 1
    from public.services s
    where s.id = service_availability_blackouts.service_id
      and s.status = 'active'::public.service_status
  )
  or exists (
    select 1
    from public.services s
    left join public.professional_profiles pp on pp.id = s.professional_id
    left join public.businesses b on b.id = s.business_id
    where s.id = service_availability_blackouts.service_id
      and (
        pp.user_id = (select auth.uid())
        or b.owner_user_id = (select auth.uid())
      )
  )
);
