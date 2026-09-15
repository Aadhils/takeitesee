-- Align Provider service draft validation with the catalog already exposed by
-- get_provider_launch_options().
--
-- Provider service creation validates the selected canonical category through
-- direct table reads. The previous RLS model only allowed Admin/Super Admin to
-- read platform_applications/platform_categories directly, so a Provider could
-- select an option returned by the Provider launch RPC but the Save API would
-- incorrectly report that the category was unavailable.
--
-- Keep this narrow: only authenticated Provider accounts may read the active
-- TakeItEsee Services application and its active categories. Anonymous access,
-- non-Services applications, mutations, finance, recurrence, and recovery are
-- unchanged.

drop policy if exists platform_applications_provider_services_read on public.platform_applications;
create policy platform_applications_provider_services_read
on public.platform_applications
for select
to authenticated
using (
  status = 'active'
  and code = 'services'
  and (
    exists (
      select 1
      from public.professional_profiles pp
      where pp.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  )
);

drop policy if exists platform_categories_provider_services_read on public.platform_categories;
create policy platform_categories_provider_services_read
on public.platform_categories
for select
to authenticated
using (
  active = true
  and exists (
    select 1
    from public.platform_applications pa
    where pa.id = application_id
      and pa.status = 'active'
      and pa.code = 'services'
  )
  and (
    exists (
      select 1
      from public.professional_profiles pp
      where pp.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.businesses b
      where b.owner_user_id = (select auth.uid())
    )
  )
);
