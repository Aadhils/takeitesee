-- Universal Services Ecosystem: make recurring proposal pricing semantics explicit.
-- Existing proposals remain per-occurrence for backward compatibility.

alter table public.requirement_proposals
  add column if not exists pricing_basis text not null default 'per_occurrence';

alter table public.requirement_proposals
  drop constraint if exists requirement_proposals_pricing_basis_check;
alter table public.requirement_proposals
  add constraint requirement_proposals_pricing_basis_check
  check (pricing_basis in ('per_occurrence','whole_requirement'));

create or replace function public.provider_submit_requirement_proposal(
  target_requirement_id uuid,
  target_service_id uuid,
  target_amount_minor bigint,
  target_message text,
  target_estimated_start_date date,
  target_pricing_basis text
)
returns public.requirement_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value public.requirement_proposals%rowtype;
  req public.customer_requirements%rowtype;
  message_value text:=btrim(coalesce(target_message,''));
  pricing_basis_value text:=lower(btrim(coalesce(target_pricing_basis,'per_occurrence')));
begin
  if auth.uid() is null then raise exception 'Provider authentication required.'; end if;
  if target_amount_minor is null or target_amount_minor<=0 then raise exception 'Proposal amount must be positive.'; end if;
  if char_length(message_value)<20 or char_length(message_value)>2000 then raise exception 'Proposal message must be 20 to 2000 characters.'; end if;
  if target_estimated_start_date is not null and target_estimated_start_date<current_date then raise exception 'Estimated start date cannot be in the past.'; end if;
  if pricing_basis_value not in ('per_occurrence','whole_requirement') then raise exception 'Proposal pricing basis is invalid.'; end if;

  select * into req from public.customer_requirements where id=target_requirement_id for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if req.status<>'open' then raise exception 'This requirement is not accepting proposals.'; end if;
  if req.schedule_pattern<>'recurring' and pricing_basis_value<>'per_occurrence' then
    raise exception 'One-time requirements support per-occurrence pricing only.';
  end if;
  if not public.provider_service_matches_requirement(target_service_id,target_requirement_id,auth.uid()) then
    raise exception 'Your verified active service does not match this requirement.';
  end if;
  if exists(select 1 from public.requirement_proposals where requirement_id=target_requirement_id and provider_user_id=auth.uid()) then
    raise exception 'You already submitted a proposal for this requirement.';
  end if;

  insert into public.requirement_proposals(
    proposal_reference,requirement_id,provider_user_id,service_id,amount_minor,currency,message,estimated_start_date,pricing_basis,status
  ) values (
    'PROP-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    target_requirement_id,auth.uid(),target_service_id,target_amount_minor,req.currency,message_value,target_estimated_start_date,pricing_basis_value,'submitted'
  ) returning * into row_value;
  insert into public.requirement_proposal_events(proposal_id,requirement_id,actor_user_id,event_type)
  values(row_value.id,row_value.requirement_id,auth.uid(),'submitted');
  return row_value;
end;
$$;

revoke all on function public.provider_submit_requirement_proposal(uuid,uuid,bigint,text,date,text) from public,anon;
grant execute on function public.provider_submit_requirement_proposal(uuid,uuid,bigint,text,date,text) to authenticated;

create or replace function public.get_customer_requirement_proposals(target_requirement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Customer authentication required.'; end if;
  if not exists(select 1 from public.customer_requirements r where r.id=target_requirement_id and r.customer_id=auth.uid()) then
    raise exception 'You can view proposals only for your own requirement.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,
    'proposal_reference',p.proposal_reference,
    'provider_user_id',p.provider_user_id,
    'provider_display_name',case
      when s.provider_type::text='business' then coalesce(nullif(btrim(b.name),''),'Verified business')
      else coalesce(nullif(btrim(pp.headline),''),'Verified professional')
    end,
    'provider_type',s.provider_type::text,
    'service_id',p.service_id,
    'service_name',s.name,
    'amount_minor',p.amount_minor,
    'currency',p.currency,
    'pricing_basis',p.pricing_basis,
    'message',p.message,
    'estimated_start_date',p.estimated_start_date,
    'status',p.status,
    'submitted_at',p.submitted_at,
    'decided_at',p.decided_at
  ) order by p.created_at desc),'[]'::jsonb)
  into result_value
  from public.requirement_proposals p
  join public.services s on s.id=p.service_id
  left join public.businesses b on b.id=s.business_id
  left join public.professional_profiles pp on pp.id=s.professional_id
  where p.requirement_id=target_requirement_id;
  return result_value;
end;
$$;

revoke all on function public.get_customer_requirement_proposals(uuid) from public,anon;
grant execute on function public.get_customer_requirement_proposals(uuid) to authenticated;

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
        'amount_minor',p.amount_minor,'currency',p.currency,'pricing_basis',p.pricing_basis,'message',p.message,
        'estimated_start_date',p.estimated_start_date,'status',p.status,'submitted_at',p.submitted_at,'decided_at',p.decided_at,
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
