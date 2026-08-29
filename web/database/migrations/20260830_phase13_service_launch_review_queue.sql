-- Read-only, permission-filtered review queue for platform administrators.
create or replace function public.get_service_launch_review_queue()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.is_active_admin()) then raise exception 'Admin authentication required.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',r.id,
      'applicant_user_id',r.applicant_user_id,
      'service_id',r.service_id,
      'service_name',s.name,
      'provider_type',s.provider_type::text,
      'provider_name',case when s.provider_type='business'::public.provider_type then b.name else coalesce(p.headline,u.name,'Professional provider') end,
      'application_id',r.requested_application_id,
      'application_name',pa.name,
      'category_id',r.requested_category_id,
      'category_name',pc.name,
      'location_id',r.requested_location_id,
      'location_name',pl.name,
      'status',r.status,
      'review_note',r.review_note,
      'reviewed_at',r.reviewed_at,
      'created_at',r.created_at
    ) order by r.created_at desc)
    from public.service_launch_requests r
    join public.services s on s.id=r.service_id
    join public.platform_applications pa on pa.id=r.requested_application_id
    join public.platform_categories pc on pc.id=r.requested_category_id
    join public.platform_locations pl on pl.id=r.requested_location_id
    left join public.businesses b on b.id=s.business_id
    left join public.professional_profiles p on p.id=s.professional_id
    left join public.users u on u.id=p.user_id
    where public.is_super_admin() or public.admin_can_view(r.requested_application_id,r.requested_location_id,r.requested_category_id,r.service_id)
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.get_service_launch_review_queue() from public,anon;
grant execute on function public.get_service_launch_review_queue() to authenticated;
