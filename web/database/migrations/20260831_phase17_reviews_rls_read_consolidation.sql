-- Phase 17: consolidate overlapping reviews SELECT policies while preserving public review visibility.
--
-- Keep published reviews public to anonymous callers, but scope that public policy to anon only.
-- Authenticated callers receive one SELECT policy that preserves the exact existing union of:
-- published reviews, Customer-owned reviews, Provider-owned reviews, and scoped Admin visibility.
--
-- The existing Customer INSERT policy and scoped Admin UPDATE policy are intentionally unchanged.
-- Canonical rollback-only verification covered anonymous, ordinary authenticated, Customer,
-- Provider-owner, and delegated Admin personas with published, hidden, and pending reviews.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state remain HOLD.

drop policy if exists published_reviews_public_read on public.reviews;
create policy published_reviews_public_read
on public.reviews
for select
to anon
using (status = 'published');

drop policy if exists customers_read_own_reviews on public.reviews;
drop policy if exists providers_read_their_reviews on public.reviews;
drop policy if exists reviews_admin_read_scoped on public.reviews;

create policy reviews_authenticated_read_authorized
on public.reviews
for select
to authenticated
using (
  status = 'published'
  or customer_id = (select auth.uid())
  or (
    provider_type = 'professional'
    and exists (
      select 1
      from public.professional_profiles p
      where p.id = reviews.professional_id
        and p.user_id = (select auth.uid())
    )
  )
  or (
    provider_type = 'business'
    and exists (
      select 1
      from public.businesses b
      where b.id = reviews.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  or exists (
    select 1
    from public.service_ecosystem_scope ses
    where ses.service_id = reviews.service_id
      and ses.enabled = true
      and private.admin_can_view(
        ses.application_id,
        ses.location_id,
        ses.category_id,
        ses.service_id
      )
  )
);
