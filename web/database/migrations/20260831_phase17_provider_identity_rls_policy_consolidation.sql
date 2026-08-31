-- Phase 17: consolidate overlapping provider identity SELECT policies.
--
-- Canonical transaction dry-run verified exact row visibility for anonymous users,
-- an unverified provider owner, a non-owner scoped Admin, and delegated Super Admin.
--
-- Preserve anonymous visibility as verified-only while combining authenticated verified,
-- owner, and Super Admin visibility into one permissive SELECT policy per provider table.
-- This removes duplicate authenticated SELECT-policy evaluation without changing row access.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

-- Businesses.
drop policy if exists businesses_owner_read on public.businesses;
drop policy if exists businesses_public_verified_read on public.businesses;

create policy businesses_public_verified_read
on public.businesses
for select
to anon
using (verified = true);

create policy businesses_authenticated_read
on public.businesses
for select
to authenticated
using (
  verified = true
  or owner_user_id = (select auth.uid())
  or private.is_super_admin()
);

-- Professional profiles.
drop policy if exists professionals_owner_read on public.professional_profiles;
drop policy if exists professionals_public_verified_read on public.professional_profiles;

create policy professionals_public_verified_read
on public.professional_profiles
for select
to anon
using (verified = true);

create policy professionals_authenticated_read
on public.professional_profiles
for select
to authenticated
using (
  verified = true
  or user_id = (select auth.uid())
  or private.is_super_admin()
);
