-- Phase 17: consolidate service-availability read policies without changing Provider writes.
--
-- The three availability tables currently combine a PUBLIC active-service SELECT policy with an
-- authenticated Provider FOR ALL policy. Because FOR ALL also applies to SELECT, authenticated
-- Provider reads evaluate two permissive policies. Split Provider writes by command and express
-- the exact read union (active service OR owned service) in one PUBLIC SELECT policy per table.
--
-- Canonical transaction dry-runs verified exact anon, authenticated non-owner, and Provider-owner
-- visibility for active plus paused-service fixtures. Provider UPDATE/INSERT/DELETE behavior and
-- non-owner write denial were also identical before and after the proposed policy shape.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

-- service_availability

drop policy if exists availability_provider_manage_own on public.service_availability;
drop policy if exists availability_public_read_active on public.service_availability;

create policy availability_read
on public.service_availability
for select
to public
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

create policy availability_provider_insert
on public.service_availability
for insert
to authenticated
with check (
  exists (
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

create policy availability_provider_update
on public.service_availability
for update
to authenticated
using (
  exists (
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
)
with check (
  exists (
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

create policy availability_provider_delete
on public.service_availability
for delete
to authenticated
using (
  exists (
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

drop policy if exists availability_windows_provider_manage_own on public.service_availability_windows;
drop policy if exists availability_windows_public_read_active on public.service_availability_windows;

create policy availability_windows_read
on public.service_availability_windows
for select
to public
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

create policy availability_windows_provider_insert
on public.service_availability_windows
for insert
to authenticated
with check (
  exists (
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

create policy availability_windows_provider_update
on public.service_availability_windows
for update
to authenticated
using (
  exists (
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
)
with check (
  exists (
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

create policy availability_windows_provider_delete
on public.service_availability_windows
for delete
to authenticated
using (
  exists (
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

drop policy if exists availability_blackouts_provider_manage_own on public.service_availability_blackouts;
drop policy if exists availability_blackouts_public_read_active on public.service_availability_blackouts;

create policy availability_blackouts_read
on public.service_availability_blackouts
for select
to public
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

create policy availability_blackouts_provider_insert
on public.service_availability_blackouts
for insert
to authenticated
with check (
  exists (
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

create policy availability_blackouts_provider_update
on public.service_availability_blackouts
for update
to authenticated
using (
  exists (
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
)
with check (
  exists (
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

create policy availability_blackouts_provider_delete
on public.service_availability_blackouts
for delete
to authenticated
using (
  exists (
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
