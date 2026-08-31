-- Phase 17: consolidate overlapping non-finance platform catalog RLS read policies.
--
-- Canonical transaction dry-run verified exact row visibility for delegated platform-manage
-- Super Admin, scoped Admin, and an ordinary authenticated user across applications,
-- categories, locations, application-location mappings, and service ecosystem scope.
--
-- The previous Super Admin FOR ALL policies are split into explicit INSERT / UPDATE / DELETE
-- policies while the overlapping SELECT paths are combined with their original logical OR.
-- This preserves Super Admin writes and Admin read scope while removing duplicate permissive
-- SELECT-policy evaluation.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

-- Platform applications.
drop policy if exists platform_applications_admin_read on public.platform_applications;
drop policy if exists platform_applications_super_write on public.platform_applications;

create policy platform_applications_authenticated_read
on public.platform_applications
for select
to authenticated
using (
  private.is_active_admin()
  or private.is_super_admin()
);

create policy platform_applications_super_insert
on public.platform_applications
for insert
to authenticated
with check (private.is_super_admin());

create policy platform_applications_super_update
on public.platform_applications
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy platform_applications_super_delete
on public.platform_applications
for delete
to authenticated
using (private.is_super_admin());

-- Platform categories.
drop policy if exists platform_categories_admin_read on public.platform_categories;
drop policy if exists platform_categories_super_write on public.platform_categories;

create policy platform_categories_authenticated_read
on public.platform_categories
for select
to authenticated
using (
  private.admin_can_view(application_id, null, id, null)
  or private.is_super_admin()
);

create policy platform_categories_super_insert
on public.platform_categories
for insert
to authenticated
with check (private.is_super_admin());

create policy platform_categories_super_update
on public.platform_categories
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy platform_categories_super_delete
on public.platform_categories
for delete
to authenticated
using (private.is_super_admin());

-- Platform locations.
drop policy if exists platform_locations_admin_read on public.platform_locations;
drop policy if exists platform_locations_super_write on public.platform_locations;

create policy platform_locations_authenticated_read
on public.platform_locations
for select
to authenticated
using (
  private.is_active_admin()
  or private.is_super_admin()
);

create policy platform_locations_super_insert
on public.platform_locations
for insert
to authenticated
with check (private.is_super_admin());

create policy platform_locations_super_update
on public.platform_locations
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy platform_locations_super_delete
on public.platform_locations
for delete
to authenticated
using (private.is_super_admin());

-- Application-location mappings.
drop policy if exists application_locations_admin_read on public.application_locations;
drop policy if exists application_locations_super_write on public.application_locations;

create policy application_locations_authenticated_read
on public.application_locations
for select
to authenticated
using (
  private.admin_can_view(application_id, location_id, null, null)
  or private.is_super_admin()
);

create policy application_locations_super_insert
on public.application_locations
for insert
to authenticated
with check (private.is_super_admin());

create policy application_locations_super_update
on public.application_locations
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy application_locations_super_delete
on public.application_locations
for delete
to authenticated
using (private.is_super_admin());

-- Service ecosystem scope.
drop policy if exists service_ecosystem_scope_admin_read on public.service_ecosystem_scope;
drop policy if exists service_ecosystem_scope_super_write on public.service_ecosystem_scope;

create policy service_ecosystem_scope_authenticated_read
on public.service_ecosystem_scope
for select
to authenticated
using (
  private.admin_can_view(application_id, location_id, category_id, service_id)
  or private.is_super_admin()
);

create policy service_ecosystem_scope_super_insert
on public.service_ecosystem_scope
for insert
to authenticated
with check (private.is_super_admin());

create policy service_ecosystem_scope_super_update
on public.service_ecosystem_scope
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy service_ecosystem_scope_super_delete
on public.service_ecosystem_scope
for delete
to authenticated
using (private.is_super_admin());
