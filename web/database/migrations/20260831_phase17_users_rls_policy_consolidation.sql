-- Phase 17: consolidate overlapping authenticated SELECT policies on public.users.
--
-- Canonical transaction dry-run verified exact visible user-id sets for an ordinary user,
-- a scoped Admin, and delegated Super Admin before and after consolidation.
--
-- Preserve self-read plus the existing Super/scoped-Admin customer visibility predicate in
-- one permissive authenticated SELECT policy. The self UPDATE policy is intentionally unchanged.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

drop policy if exists users_select_admin_scoped_customers on public.users;
drop policy if exists users_select_self on public.users;

create policy users_authenticated_read
on public.users
for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_super_admin()
  or exists (
    select 1
    from public.bookings b
    join public.service_ecosystem_scope ses
      on ses.service_id = b.service_id
     and ses.enabled = true
    where b.customer_id = users.id
      and private.admin_can_view(
        ses.application_id,
        ses.location_id,
        ses.category_id,
        ses.service_id
      )
  )
);
