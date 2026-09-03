-- Universal Services Ecosystem: expose recurring requirement intent to matched providers.
-- Keeps the existing verified-provider/category/location/service matching boundary unchanged.

create or replace function public.get_provider_requirement_leads()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Provider authentication required.'; end if;
  if not exists(select 1 from public.professional_profiles where user_id=auth.uid())
     and not exists(select 1 from public.businesses where owner_user_id=auth.uid()) then
    raise exception 'Provider account is required.';
  end if;

  select jsonb_build_object(
    'leads',coalesce((
      select jsonb_agg(x order by (x->>'published_at') desc)
      from (
        select jsonb_build_object(
          'id',r.id,'requirement_reference',r.requirement_reference,'title',r.title,'description',r.description,
          'service_mode',r.service_mode,'budget_type',r.budget_type,'budget_min_minor',r.budget_min_minor,
          'budget_max_minor',r.budget_max_minor,'currency',r.currency,'needed_by',r.needed_by,
          'preferred_start_time',r.preferred_start_time,'expected_duration_minutes',r.expected_duration_minutes,
          'schedule_pattern',r.schedule_pattern,'recurrence_frequency',r.recurrence_frequency,
          'recurrence_interval',r.recurrence_interval,'recurrence_count',r.recurrence_count,
          'status',r.status,'published_at',r.published_at,'category_name',pc.name,'location_name',pl.name,
          'matching_service_id',min(s.id::text),
          'already_proposed',exists(select 1 from public.requirement_proposals rp where rp.requirement_id=r.id and rp.provider_user_id=auth.uid())
        ) x
        from public.customer_requirements r
        join public.platform_categories pc on pc.id=r.category_id
        join public.platform_locations pl on pl.id=r.location_id
        join public.services s on public.provider_service_matches_requirement(s.id,r.id,auth.uid())
        where r.status='open'
        group by r.id,pc.name,pl.name
      ) q
    ),'[]'::jsonb),
    'proposals',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'proposal_reference',p.proposal_reference,'requirement_id',p.requirement_id,'service_id',p.service_id,
        'amount_minor',p.amount_minor,'currency',p.currency,'message',p.message,'estimated_start_date',p.estimated_start_date,
        'status',p.status,'submitted_at',p.submitted_at,'decided_at',p.decided_at,
        'requirement_reference',r.requirement_reference,'requirement_title',r.title,'requirement_status',r.status,
        'category_name',pc.name,'location_name',pl.name
      ) order by p.created_at desc)
      from public.requirement_proposals p
      join public.customer_requirements r on r.id=p.requirement_id
      join public.platform_categories pc on pc.id=r.category_id
      join public.platform_locations pl on pl.id=r.location_id
      where p.provider_user_id=auth.uid()
    ),'[]'::jsonb)
  ) into result_value;
  return result_value;
end;
$$;

revoke all on function public.get_provider_requirement_leads() from public,anon;
grant execute on function public.get_provider_requirement_leads() to authenticated;
