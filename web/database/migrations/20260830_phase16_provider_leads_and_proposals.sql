-- Phase 16 Module 2: verified provider lead matching and customer proposal decisions.

-- Extend requirement lifecycle with an awarded state that represents provider selection,
-- while fulfilled remains the true post-service terminal state.
alter table public.customer_requirements drop constraint if exists customer_requirements_status_check;
alter table public.customer_requirements
  add constraint customer_requirements_status_check
  check (status in ('open','paused','awarded','fulfilled','cancelled'));

alter table public.customer_requirements drop constraint if exists customer_requirements_check1;
alter table public.customer_requirements
  add constraint customer_requirements_check1
  check (
    (status in ('open','paused','awarded') and closed_at is null)
    or (status in ('fulfilled','cancelled') and closed_at is not null)
  );

alter table public.customer_requirement_events drop constraint if exists customer_requirement_events_to_status_check;
alter table public.customer_requirement_events
  add constraint customer_requirement_events_to_status_check
  check (to_status in ('open','paused','awarded','fulfilled','cancelled'));

alter table public.customer_requirement_events drop constraint if exists customer_requirement_events_from_status_check;
alter table public.customer_requirement_events
  add constraint customer_requirement_events_from_status_check
  check (from_status is null or from_status in ('open','paused','awarded','fulfilled','cancelled'));

create table if not exists public.requirement_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_reference text not null unique,
  requirement_id uuid not null references public.customer_requirements(id) on delete restrict,
  provider_user_id uuid not null references public.users(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('INR','USD')),
  message text not null check (char_length(btrim(message)) between 20 and 2000),
  estimated_start_date date,
  status text not null default 'submitted' check (status in ('submitted','withdrawn','accepted','declined')),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requirement_id,provider_user_id),
  check ((status in ('submitted','withdrawn') and decided_at is null) or (status in ('accepted','declined') and decided_at is not null))
);
create unique index if not exists requirement_proposals_one_accepted_idx
  on public.requirement_proposals(requirement_id) where status='accepted';
create index if not exists requirement_proposals_requirement_created_idx
  on public.requirement_proposals(requirement_id,created_at desc);
create index if not exists requirement_proposals_provider_created_idx
  on public.requirement_proposals(provider_user_id,created_at desc);

create table if not exists public.requirement_proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.requirement_proposals(id) on delete restrict,
  requirement_id uuid not null references public.customer_requirements(id) on delete restrict,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('submitted','withdrawn','accepted','declined')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists requirement_proposal_events_proposal_created_idx
  on public.requirement_proposal_events(proposal_id,created_at);

alter table public.customer_requirements add column if not exists accepted_proposal_id uuid;
alter table public.customer_requirements add column if not exists awarded_at timestamptz;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='customer_requirements_accepted_proposal_id_fkey') then
    alter table public.customer_requirements
      add constraint customer_requirements_accepted_proposal_id_fkey
      foreign key (accepted_proposal_id) references public.requirement_proposals(id) on delete restrict;
  end if;
end $$;

alter table public.requirement_proposals enable row level security;
alter table public.requirement_proposal_events enable row level security;
revoke all on public.requirement_proposals from anon;
revoke all on public.requirement_proposal_events from anon;
revoke insert,update,delete on public.requirement_proposals from authenticated;
revoke insert,update,delete on public.requirement_proposal_events from authenticated;
grant select on public.requirement_proposals to authenticated;
grant select on public.requirement_proposal_events to authenticated;

drop policy if exists requirement_proposals_participant_admin_read on public.requirement_proposals;
create policy requirement_proposals_participant_admin_read on public.requirement_proposals
for select to authenticated using (
  provider_user_id=auth.uid()
  or exists(select 1 from public.customer_requirements r where r.id=requirement_proposals.requirement_id and r.customer_id=auth.uid())
  or public.is_super_admin()
  or public.admin_can_manage(null,null,null,null)
);

drop policy if exists requirement_proposal_events_participant_admin_read on public.requirement_proposal_events;
create policy requirement_proposal_events_participant_admin_read on public.requirement_proposal_events
for select to authenticated using (
  exists(
    select 1 from public.requirement_proposals p
    join public.customer_requirements r on r.id=p.requirement_id
    where p.id=requirement_proposal_events.proposal_id
      and (p.provider_user_id=auth.uid() or r.customer_id=auth.uid() or public.is_super_admin() or public.admin_can_manage(null,null,null,null))
  )
);

create or replace function public.requirement_category_matches_scope(scope_category_id uuid, requirement_category_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  with recursive lineage as (
    select c.id,c.parent_id from public.platform_categories c where c.id=requirement_category_id
    union all
    select p.id,p.parent_id from public.platform_categories p join lineage l on l.parent_id=p.id
  )
  select exists(select 1 from lineage where id=scope_category_id);
$$;
revoke all on function public.requirement_category_matches_scope(uuid,uuid) from public,anon,authenticated;
grant execute on function public.requirement_category_matches_scope(uuid,uuid) to service_role;

create or replace function public.provider_service_matches_requirement(target_service_id uuid,target_requirement_id uuid,target_provider_user_id uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.services s
    join public.service_ecosystem_scope ses on ses.service_id=s.id and ses.enabled=true
    join public.customer_requirements r on r.id=target_requirement_id
    where s.id=target_service_id
      and r.status='open'
      and ses.location_id=r.location_id
      and public.requirement_category_matches_scope(ses.category_id,r.category_id)
      and s.status='active'::public.service_status
      and s.active=true
      and public.provider_owner_is_verified(s.provider_type::text,s.professional_id,s.business_id)
      and public.provider_profile_is_complete(s.provider_type::text,s.professional_id,s.business_id)
      and public.provider_trust_allows_marketplace(s.provider_type::text,s.professional_id,s.business_id)
      and public.service_scope_is_launchable(s.id)
      and (
        exists(select 1 from public.professional_profiles pp where pp.id=s.professional_id and pp.user_id=target_provider_user_id)
        or exists(select 1 from public.businesses b where b.id=s.business_id and b.owner_user_id=target_provider_user_id)
      )
  );
$$;
revoke all on function public.provider_service_matches_requirement(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.provider_service_matches_requirement(uuid,uuid,uuid) to service_role;

create or replace function public.get_provider_requirement_leads()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
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
          'budget_max_minor',r.budget_max_minor,'currency',r.currency,'needed_by',r.needed_by,'status',r.status,
          'published_at',r.published_at,'category_name',pc.name,'location_name',pl.name,'matching_service_id',min(s.id)::text,
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

create or replace function public.provider_submit_requirement_proposal(
  target_requirement_id uuid,
  target_service_id uuid,
  target_amount_minor bigint,
  target_message text,
  target_estimated_start_date date
)
returns public.requirement_proposals
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.requirement_proposals%rowtype; req public.customer_requirements%rowtype; message_value text:=btrim(coalesce(target_message,''));
begin
  if auth.uid() is null then raise exception 'Provider authentication required.'; end if;
  if target_amount_minor is null or target_amount_minor<=0 then raise exception 'Proposal amount must be positive.'; end if;
  if char_length(message_value)<20 or char_length(message_value)>2000 then raise exception 'Proposal message must be 20 to 2000 characters.'; end if;
  if target_estimated_start_date is not null and target_estimated_start_date<current_date then raise exception 'Estimated start date cannot be in the past.'; end if;

  select * into req from public.customer_requirements where id=target_requirement_id for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if req.status<>'open' then raise exception 'This requirement is not accepting proposals.'; end if;
  if not public.provider_service_matches_requirement(target_service_id,target_requirement_id,auth.uid()) then
    raise exception 'Your verified active service does not match this requirement.';
  end if;
  if exists(select 1 from public.requirement_proposals where requirement_id=target_requirement_id and provider_user_id=auth.uid()) then
    raise exception 'You already submitted a proposal for this requirement.';
  end if;

  insert into public.requirement_proposals(
    proposal_reference,requirement_id,provider_user_id,service_id,amount_minor,currency,message,estimated_start_date,status
  ) values (
    'PROP-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    target_requirement_id,auth.uid(),target_service_id,target_amount_minor,req.currency,message_value,target_estimated_start_date,'submitted'
  ) returning * into row_value;
  insert into public.requirement_proposal_events(proposal_id,requirement_id,actor_user_id,event_type)
  values(row_value.id,row_value.requirement_id,auth.uid(),'submitted');
  return row_value;
end;
$$;
revoke all on function public.provider_submit_requirement_proposal(uuid,uuid,bigint,text,date) from public,anon;
grant execute on function public.provider_submit_requirement_proposal(uuid,uuid,bigint,text,date) to authenticated;

create or replace function public.provider_withdraw_requirement_proposal(target_proposal_id uuid)
returns public.requirement_proposals
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.requirement_proposals%rowtype;
begin
  if auth.uid() is null then raise exception 'Provider authentication required.'; end if;
  select * into row_value from public.requirement_proposals where id=target_proposal_id for update;
  if not found then raise exception 'Proposal was not found.'; end if;
  if row_value.provider_user_id<>auth.uid() then raise exception 'You can withdraw only your own proposal.'; end if;
  if row_value.status<>'submitted' then raise exception 'Only a submitted proposal can be withdrawn.'; end if;
  update public.requirement_proposals set status='withdrawn',updated_at=now() where id=row_value.id returning * into row_value;
  insert into public.requirement_proposal_events(proposal_id,requirement_id,actor_user_id,event_type)
  values(row_value.id,row_value.requirement_id,auth.uid(),'withdrawn');
  return row_value;
end;
$$;
revoke all on function public.provider_withdraw_requirement_proposal(uuid) from public,anon;
grant execute on function public.provider_withdraw_requirement_proposal(uuid) to authenticated;

create or replace function public.customer_decide_requirement_proposal(target_proposal_id uuid,target_decision text)
returns public.requirement_proposals
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.requirement_proposals%rowtype; req public.customer_requirements%rowtype; decision_value text:=lower(btrim(coalesce(target_decision,'')));
begin
  if auth.uid() is null then raise exception 'Customer authentication required.'; end if;
  if decision_value not in ('accept','decline') then raise exception 'Proposal decision is invalid.'; end if;
  select * into row_value from public.requirement_proposals where id=target_proposal_id for update;
  if not found then raise exception 'Proposal was not found.'; end if;
  select * into req from public.customer_requirements where id=row_value.requirement_id for update;
  if req.customer_id<>auth.uid() then raise exception 'You can manage proposals only for your own requirement.'; end if;
  if req.status not in ('open','paused') then raise exception 'This requirement no longer accepts proposal decisions.'; end if;
  if row_value.status<>'submitted' then raise exception 'Only a submitted proposal can be decided.'; end if;

  if decision_value='decline' then
    update public.requirement_proposals set status='declined',decided_at=now(),updated_at=now() where id=row_value.id returning * into row_value;
    insert into public.requirement_proposal_events(proposal_id,requirement_id,actor_user_id,event_type)
    values(row_value.id,row_value.requirement_id,auth.uid(),'declined');
    return row_value;
  end if;

  update public.requirement_proposals
  set status='declined',decided_at=now(),updated_at=now()
  where requirement_id=req.id and status='submitted' and id<>row_value.id;
  insert into public.requirement_proposal_events(proposal_id,requirement_id,actor_user_id,event_type)
  select id,requirement_id,auth.uid(),'declined' from public.requirement_proposals
  where requirement_id=req.id and status='declined' and decided_at is not null
    and not exists(select 1 from public.requirement_proposal_events e where e.proposal_id=requirement_proposals.id and e.event_type='declined');

  update public.requirement_proposals set status='accepted',decided_at=now(),updated_at=now() where id=row_value.id returning * into row_value;
  insert into public.requirement_proposal_events(proposal_id,requirement_id,actor_user_id,event_type)
  values(row_value.id,row_value.requirement_id,auth.uid(),'accepted');
  update public.customer_requirements
  set status='awarded',accepted_proposal_id=row_value.id,awarded_at=now(),updated_at=now()
  where id=req.id;
  return row_value;
end;
$$;
revoke all on function public.customer_decide_requirement_proposal(uuid,text) from public,anon;
grant execute on function public.customer_decide_requirement_proposal(uuid,text) to authenticated;

create or replace function public.customer_update_requirement_status(target_requirement_id uuid,target_status text)
returns public.customer_requirements
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.customer_requirements%rowtype; status_value text:=lower(btrim(coalesce(target_status,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if status_value not in ('open','paused','fulfilled','cancelled') then raise exception 'Requirement status is invalid.'; end if;
  select * into row_value from public.customer_requirements where id=target_requirement_id for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if row_value.customer_id<>auth.uid() then raise exception 'You can manage only your own requirement.'; end if;
  if row_value.status=status_value then return row_value; end if;
  if row_value.status in ('fulfilled','cancelled') then raise exception 'A closed requirement cannot be reopened.'; end if;
  if row_value.status='awarded' and status_value not in ('fulfilled','cancelled') then raise exception 'An awarded requirement can only be fulfilled or cancelled.'; end if;
  if row_value.status='open' and status_value not in ('paused','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;
  if row_value.status='paused' and status_value not in ('open','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;
  update public.customer_requirements
  set status=status_value,closed_at=case when status_value in ('fulfilled','cancelled') then now() else null end,updated_at=now()
  where id=row_value.id returning * into row_value;
  return row_value;
end;
$$;
revoke all on function public.customer_update_requirement_status(uuid,text) from public,anon;
grant execute on function public.customer_update_requirement_status(uuid,text) to authenticated;
