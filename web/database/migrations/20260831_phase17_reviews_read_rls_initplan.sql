-- Phase 17: optimize review read RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing authenticated role, customer ownership, provider type, and provider
-- ownership requirements remain unchanged. These policies are SELECT-only.
--
-- Published public review visibility, Admin review access, review INSERT rules,
-- moderation behavior, and booking completion requirements are intentionally
-- outside this migration.
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy customers_read_own_reviews
  on public.reviews
  using (
    customer_id = (select auth.uid())
  );

alter policy providers_read_their_reviews
  on public.reviews
  using (
    (
      provider_type = 'professional'::text
      and exists (
        select 1
        from public.professional_profiles p
        where p.id = reviews.professional_id
          and p.user_id = (select auth.uid())
      )
    )
    or
    (
      provider_type = 'business'::text
      and exists (
        select 1
        from public.businesses b
        where b.id = reviews.business_id
          and b.owner_user_id = (select auth.uid())
      )
    )
  );
