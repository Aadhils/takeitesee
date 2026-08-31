-- Phase 17: convert audited read-only application RPCs to SECURITY INVOKER where RLS preserves exact behavior.
--
-- Transaction dry-runs on the canonical production database verified:
-- - get_my_provider_trust_state() returns an exact-match Provider payload as SECURITY INVOKER.
-- - get_service_launch_review_queue() returns an exact-match Admin payload when its authorization helpers
--   call the non-exposed private schema directly.
-- - list_provider_trust_overview() returns an exact-match platform-manage Admin payload with the same pattern.
-- - Ordinary authenticated users remain denied by the existing authorization checks/RLS.
--
-- get_provider_launch_options() and get_provider_setup_readiness() are intentionally excluded because
-- SECURITY INVOKER changes their catalog/enrichment visibility under the current RLS model.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are untouched.

alter function public.get_my_provider_trust_state()
  security invoker;

create or replace function public.get_service_launch_review_queue()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not (private.is_super_admin() or private.is_active_admin()) then
    raise exception 'Admin authentication required.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'applicant_user_id', r.applicant_user_id,
        'service_id', r.service_id,
        'service_name', s.name,
        'provider_type', s.provider_type::text,
        'provider_name', case
          when s.provider_type = 'business'::public.provider_type then b.name
          else coalesce(p.headline, u.name, 'Professional provider')
        end,
        'application_id', r.requested_application_id,
        'application_name', pa.name,
        'category_id', r.requested_category_id,
        'category_name', pc.name,
        'location_id', r.requested_location_id,
        'location_name', pl.name,
        'status', r.status,
        'review_note', r.review_note,
        'reviewed_at', r.reviewed_at,
        'created_at', r.created_at
      )
      order by r.created_at desc
    )
    from public.service_launch_requests r
    join public.services s on s.id = r.service_id
    join public.platform_applications pa on pa.id = r.requested_application_id
    join public.platform_categories pc on pc.id = r.requested_category_id
    join public.platform_locations pl on pl.id = r.requested_location_id
    left join public.businesses b on b.id = s.business_id
    left join public.professional_profiles p on p.id = s.professional_id
    left join public.users u on u.id = p.user_id
    where private.is_super_admin()
       or private.admin_can_view(
         r.requested_application_id,
         r.requested_location_id,
         r.requested_category_id,
         r.service_id
       )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_provider_trust_overview()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not (
    private.is_super_admin()
    or private.admin_can_manage(null, null, null, null)
  ) then
    raise exception 'Platform manage permission is required.';
  end if;

  return coalesce((
    select jsonb_agg(row_data order by (row_data->>'updated_at') desc)
    from (
      select jsonb_build_object(
        'trust_state_id', s.id,
        'provider_type', s.provider_type,
        'provider_id', coalesce(s.professional_id, s.business_id),
        'owner_user_id', s.owner_user_id,
        'display_name', case
          when s.provider_type = 'professional' then coalesce(p.headline, u.name, 'Professional provider')
          else coalesce(b.name, 'Business provider')
        end,
        'verified', case
          when s.provider_type = 'professional' then coalesce(p.verified, false)
          else coalesce(b.verified, false)
        end,
        'status', s.status,
        'reason', s.reason,
        'active_services', (
          select count(*)::int
          from public.services svc
          where svc.status = 'active'::public.service_status
            and svc.active = true
            and (
              (s.provider_type = 'professional' and svc.professional_id = s.professional_id)
              or (s.provider_type = 'business' and svc.business_id = s.business_id)
            )
        ),
        'updated_at', s.updated_at
      ) as row_data
      from public.provider_trust_states s
      left join public.professional_profiles p on p.id = s.professional_id
      left join public.businesses b on b.id = s.business_id
      left join public.users u on u.id = s.owner_user_id
    ) q
  ), '[]'::jsonb);
end;
$$;
