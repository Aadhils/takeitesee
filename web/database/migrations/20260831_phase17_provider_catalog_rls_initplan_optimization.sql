-- Phase 17: optimize provider catalog and availability RLS auth initplans.
--
-- Only auth.uid() calls are wrapped in scalar subqueries so Postgres can
-- evaluate the authenticated user once per statement. Existing provider
-- ownership checks, service launch guards, verification/trust requirements,
-- policy names, commands, roles, and write checks remain unchanged.
--
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy services_provider_read_own
  on public.services
  using (
    exists (
      select 1
      from public.professional_profiles pp
      where pp.id = services.professional_id
        and pp.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.businesses b
      where b.id = services.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

alter policy services_provider_delete_own
  on public.services
  using (
    exists (
      select 1
      from public.professional_profiles pp
      where pp.id = services.professional_id
        and pp.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.businesses b
      where b.id = services.business_id
        and b.owner_user_id = (select auth.uid())
    )
  );

alter policy services_provider_insert_own
  on public.services
  with check (
    (
      exists (
        select 1
        from public.professional_profiles pp
        where pp.id = services.professional_id
          and pp.user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.businesses b
        where b.id = services.business_id
          and b.owner_user_id = (select auth.uid())
      )
    )
    and (
      ((status <> 'active'::public.service_status) and (active = false))
      or (
        public.provider_owner_is_verified((provider_type)::text, professional_id, business_id)
        and public.provider_profile_is_complete((provider_type)::text, professional_id, business_id)
        and public.service_scope_is_launchable(id)
        and public.provider_trust_allows_marketplace((provider_type)::text, professional_id, business_id)
      )
    )
  );

alter policy services_provider_update_own
  on public.services
  using (
    exists (
      select 1
      from public.professional_profiles pp
      where pp.id = services.professional_id
        and pp.user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.businesses b
      where b.id = services.business_id
        and b.owner_user_id = (select auth.uid())
    )
  )
  with check (
    (
      exists (
        select 1
        from public.professional_profiles pp
        where pp.id = services.professional_id
          and pp.user_id = (select auth.uid())
      )
      or exists (
        select 1
        from public.businesses b
        where b.id = services.business_id
          and b.owner_user_id = (select auth.uid())
      )
    )
    and (
      ((status <> 'active'::public.service_status) and (active = false))
      or (
        public.provider_owner_is_verified((provider_type)::text, professional_id, business_id)
        and public.provider_profile_is_complete((provider_type)::text, professional_id, business_id)
        and public.service_scope_is_launchable(id)
        and public.provider_trust_allows_marketplace((provider_type)::text, professional_id, business_id)
      )
    )
  );

alter policy availability_provider_manage_own
  on public.service_availability
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

alter policy availability_windows_provider_manage_own
  on public.service_availability_windows
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

alter policy availability_blackouts_provider_manage_own
  on public.service_availability_blackouts
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
