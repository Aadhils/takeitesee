-- Recheck Provider/service marketplace eligibility at the moment a customer accepts a proposal.
-- Customer decline behavior remains unchanged. Finance/Cashfree/payment/refund/payout/settlement/recovery is untouched.

create or replace function private.requirement_proposal_provider_is_currently_eligible(
  p_service_id uuid,
  p_requirement_id uuid,
  p_provider_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.services s
    join public.service_ecosystem_scope ses
      on ses.service_id = s.id
     and ses.enabled = true
    join public.customer_requirements r
      on r.id = p_requirement_id
    where s.id = p_service_id
      and r.status in ('open', 'paused')
      and ses.location_id = r.location_id
      and public.requirement_category_matches_scope(ses.category_id, r.category_id)
      and s.status = 'active'::public.service_status
      and s.active = true
      and private.provider_owner_is_verified(s.provider_type::text, s.professional_id, s.business_id)
      and private.provider_profile_is_complete(s.provider_type::text, s.professional_id, s.business_id)
      and private.provider_marketplace_disclosure_is_complete(s.provider_type::text, s.professional_id, s.business_id)
      and private.provider_trust_allows_marketplace(s.provider_type::text, s.professional_id, s.business_id)
      and private.service_scope_is_launchable(s.id)
      and exists(
        select 1
        from public.service_fulfillment_modes sfm
        where sfm.service_id = s.id
          and sfm.active = true
          and (
            r.service_mode = 'either'
            or (
              r.service_mode = 'remote'
              and sfm.mode = 'remote'::public.marketplace_service_fulfillment_mode
            )
            or (
              r.service_mode = 'onsite'
              and sfm.mode in (
                'at_provider'::public.marketplace_service_fulfillment_mode,
                'at_customer'::public.marketplace_service_fulfillment_mode
              )
            )
          )
      )
      and (
        exists(
          select 1
          from public.professional_profiles pp
          where pp.id = s.professional_id
            and pp.user_id = p_provider_user_id
        )
        or exists(
          select 1
          from public.businesses b
          where b.id = s.business_id
            and b.owner_user_id = p_provider_user_id
        )
      )
  );
$$;

revoke all on function private.requirement_proposal_provider_is_currently_eligible(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.requirement_proposal_provider_is_currently_eligible(uuid, uuid, uuid)
  to service_role;

create or replace function public.customer_decide_requirement_proposal(
  target_proposal_id uuid,
  target_decision text
)
returns public.requirement_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value public.requirement_proposals%rowtype;
  req public.customer_requirements%rowtype;
  decision_value text := lower(btrim(coalesce(target_decision, '')));
begin
  if auth.uid() is null then
    raise exception 'Customer authentication required.';
  end if;

  if decision_value not in ('accept', 'decline') then
    raise exception 'Proposal decision is invalid.';
  end if;

  select *
    into row_value
    from public.requirement_proposals
   where id = target_proposal_id
   for update;
  if not found then
    raise exception 'Proposal was not found.';
  end if;

  select *
    into req
    from public.customer_requirements
   where id = row_value.requirement_id
   for update;

  if req.customer_id <> auth.uid() then
    raise exception 'You can manage proposals only for your own requirement.';
  end if;

  if req.status not in ('open', 'paused') then
    raise exception 'This requirement no longer accepts proposal decisions.';
  end if;

  if row_value.status <> 'submitted' then
    raise exception 'Only a submitted proposal can be decided.';
  end if;

  if decision_value = 'decline' then
    update public.requirement_proposals
       set status = 'declined',
           decided_at = now(),
           updated_at = now()
     where id = row_value.id
     returning * into row_value;

    insert into public.requirement_proposal_events(
      proposal_id, requirement_id, actor_user_id, event_type
    ) values (
      row_value.id, row_value.requirement_id, auth.uid(), 'declined'
    );
    return row_value;
  end if;

  if not private.requirement_proposal_provider_is_currently_eligible(
    row_value.service_id,
    row_value.requirement_id,
    row_value.provider_user_id
  ) then
    raise exception 'This provider or service is no longer eligible for marketplace work. Review current proposals and choose another provider.';
  end if;

  update public.requirement_proposals
     set status = 'declined',
         decided_at = now(),
         updated_at = now()
   where requirement_id = req.id
     and status = 'submitted'
     and id <> row_value.id;

  insert into public.requirement_proposal_events(
    proposal_id, requirement_id, actor_user_id, event_type
  )
  select id, requirement_id, auth.uid(), 'declined'
    from public.requirement_proposals
   where requirement_id = req.id
     and status = 'declined'
     and decided_at is not null
     and not exists(
       select 1
       from public.requirement_proposal_events e
       where e.proposal_id = requirement_proposals.id
         and e.event_type = 'declined'
     );

  update public.requirement_proposals
     set status = 'accepted',
         decided_at = now(),
         updated_at = now()
   where id = row_value.id
   returning * into row_value;

  insert into public.requirement_proposal_events(
    proposal_id, requirement_id, actor_user_id, event_type
  ) values (
    row_value.id, row_value.requirement_id, auth.uid(), 'accepted'
  );

  update public.customer_requirements
     set status = 'awarded',
         accepted_proposal_id = row_value.id,
         awarded_at = now(),
         updated_at = now()
   where id = req.id;

  return row_value;
end;
$$;

revoke all on function public.customer_decide_requirement_proposal(uuid, text)
  from public, anon;
grant execute on function public.customer_decide_requirement_proposal(uuid, text)
  to authenticated;
