-- Phase 17: consolidate overlapping non-finance Admin RLS read policies.
--
-- Canonical transaction dry-run verified exact row visibility for:
-- - delegated platform-manage Super Admin
-- - scoped Admin
-- - ordinary authenticated user
--
-- Super Admin INSERT / UPDATE / DELETE behavior on memberships and scopes is preserved
-- by splitting the previous FOR ALL policies into explicit write policies, while the
-- overlapping SELECT paths are combined with the same logical OR conditions.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state
-- are intentionally untouched by this migration.

-- Admin audit log: own actor rows OR Super Admin rows.
drop policy if exists admin_audit_own_read on public.admin_audit_log;
drop policy if exists admin_audit_super_read on public.admin_audit_log;

create policy admin_audit_authenticated_read
on public.admin_audit_log
for select
to authenticated
using (
  actor_user_id = private.current_platform_user_id()
  or private.is_super_admin()
);

-- Admin memberships: combine self + Super Admin SELECT, preserve Super Admin writes.
drop policy if exists admin_memberships_select_self on public.admin_memberships;
drop policy if exists admin_memberships_super_only on public.admin_memberships;

create policy admin_memberships_authenticated_read
on public.admin_memberships
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_super_admin()
);

create policy admin_memberships_super_insert
on public.admin_memberships
for insert
to authenticated
with check (private.is_super_admin());

create policy admin_memberships_super_update
on public.admin_memberships
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy admin_memberships_super_delete
on public.admin_memberships
for delete
to authenticated
using (private.is_super_admin());

-- Admin scopes: combine own active membership + Super Admin SELECT, preserve Super Admin writes.
drop policy if exists admin_scopes_select_own_membership on public.admin_scopes;
drop policy if exists admin_scopes_super_only on public.admin_scopes;

create policy admin_scopes_authenticated_read
on public.admin_scopes
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_memberships am
    where am.id = admin_scopes.admin_membership_id
      and am.user_id = (select auth.uid())
      and am.active = true
  )
  or private.is_super_admin()
);

create policy admin_scopes_super_insert
on public.admin_scopes
for insert
to authenticated
with check (private.is_super_admin());

create policy admin_scopes_super_update
on public.admin_scopes
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy admin_scopes_super_delete
on public.admin_scopes
for delete
to authenticated
using (private.is_super_admin());
