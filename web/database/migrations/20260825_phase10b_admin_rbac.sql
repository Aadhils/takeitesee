-- Phase 10B: authenticated Super Admin + scoped Admin RBAC and RLS.
-- Requires Phase 10A.

create or replace function public.current_platform_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.id = auth.uid()
  limit 1
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and u.role = 'super_admin'::public.platform_role
  )
$$;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.users u
    join public.admin_memberships am on am.user_id = u.id
    where u.id = auth.uid()
      and u.role = 'admin'::public.platform_role
      and am.active = true
  )
$$;

create or replace function public.admin_can_view(
  p_application_id uuid default null,
  p_location_id uuid default null,
  p_category_id uuid default null,
  p_service_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.admin_memberships am
    join public.admin_scopes s on s.admin_membership_id = am.id
    where am.user_id = auth.uid()
      and am.active = true
      and s.can_view = true
      and (
        s.scope_type = 'platform'::public.admin_scope_type
        or (s.scope_type = 'application'::public.admin_scope_type and s.application_id = p_application_id)
        or (s.scope_type = 'location'::public.admin_scope_type and s.location_id = p_location_id and (s.application_id is null or s.application_id = p_application_id))
        or (s.scope_type = 'category'::public.admin_scope_type and s.category_id = p_category_id and (s.application_id is null or s.application_id = p_application_id))
        or (s.scope_type = 'service'::public.admin_scope_type and s.service_id = p_service_id and (s.application_id is null or s.application_id = p_application_id))
      )
  )
$$;

create or replace function public.admin_can_manage(
  p_application_id uuid default null,
  p_location_id uuid default null,
  p_category_id uuid default null,
  p_service_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.admin_memberships am
    join public.admin_scopes s on s.admin_membership_id = am.id
    where am.user_id = auth.uid()
      and am.active = true
      and s.can_manage = true
      and (
        s.scope_type = 'platform'::public.admin_scope_type
        or (s.scope_type = 'application'::public.admin_scope_type and s.application_id = p_application_id)
        or (s.scope_type = 'location'::public.admin_scope_type and s.location_id = p_location_id and (s.application_id is null or s.application_id = p_application_id))
        or (s.scope_type = 'category'::public.admin_scope_type and s.category_id = p_category_id and (s.application_id is null or s.application_id = p_application_id))
        or (s.scope_type = 'service'::public.admin_scope_type and s.service_id = p_service_id and (s.application_id is null or s.application_id = p_application_id))
      )
  )
$$;

revoke all on function public.current_platform_user_id() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.is_active_admin() from public;
revoke all on function public.admin_can_view(uuid, uuid, uuid, uuid) from public;
revoke all on function public.admin_can_manage(uuid, uuid, uuid, uuid) from public;
grant execute on function public.current_platform_user_id() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.is_active_admin() to authenticated;
grant execute on function public.admin_can_view(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.admin_can_manage(uuid, uuid, uuid, uuid) to authenticated;

-- Registry/location/category reads require admin membership. Writes remain Super Admin only
-- until delegated management APIs add explicit audit logging in a later phase.
create policy platform_applications_admin_read on public.platform_applications
for select to authenticated using (public.is_active_admin());
create policy platform_applications_super_write on public.platform_applications
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy platform_locations_admin_read on public.platform_locations
for select to authenticated using (public.is_active_admin());
create policy platform_locations_super_write on public.platform_locations
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy application_locations_admin_read on public.application_locations
for select to authenticated using (public.admin_can_view(application_id, location_id, null, null));
create policy application_locations_super_write on public.application_locations
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy platform_categories_admin_read on public.platform_categories
for select to authenticated using (public.admin_can_view(application_id, null, id, null));
create policy platform_categories_super_write on public.platform_categories
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

create policy service_ecosystem_scope_admin_read on public.service_ecosystem_scope
for select to authenticated using (public.admin_can_view(application_id, location_id, category_id, service_id));
create policy service_ecosystem_scope_super_write on public.service_ecosystem_scope
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Admin identities and permissions are sensitive: only Super Admin can enumerate or mutate them.
create policy admin_memberships_super_only on public.admin_memberships
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy admin_scopes_super_only on public.admin_scopes
for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Audit history is readable by Super Admin and appendable by authenticated admins.
-- Updates/deletes intentionally have no policy.
create policy admin_audit_super_read on public.admin_audit_log
for select to authenticated using (public.is_super_admin());
create policy admin_audit_admin_insert on public.admin_audit_log
for insert to authenticated with check (
  public.is_active_admin()
  and actor_user_id = public.current_platform_user_id()
);
