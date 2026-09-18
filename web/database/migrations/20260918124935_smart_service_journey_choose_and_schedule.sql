create or replace function public.customer_choose_and_schedule_requirement_provider(
  target_requirement_id uuid,
  target_proposal_id uuid,
  requested_booking_date date,
  requested_start_time time without time zone,
  requested_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal_requirement_id uuid;
  proposal_row public.requirement_proposals%rowtype;
  job_payload jsonb;
begin
  if auth.uid() is null then
    raise exception 'Customer authentication required.';
  end if;
  if target_requirement_id is null or target_proposal_id is null then
    raise exception 'Requirement and proposal are required.';
  end if;
  if requested_booking_date is null or requested_start_time is null then
    raise exception 'Service date and start time are required.';
  end if;

  select requirement_id
    into proposal_requirement_id
    from public.requirement_proposals
   where id = target_proposal_id;
  if not found then
    raise exception 'Proposal was not found.';
  end if;
  if proposal_requirement_id is distinct from target_requirement_id then
    raise exception 'Proposal does not belong to this requirement.';
  end if;

  proposal_row := public.customer_decide_requirement_proposal(target_proposal_id, 'accept');

  job_payload := public.customer_create_requirement_job(
    target_requirement_id,
    requested_booking_date,
    requested_start_time,
    requested_notes
  );

  return job_payload || jsonb_build_object(
    'proposal',
    jsonb_build_object(
      'id', proposal_row.id,
      'proposal_reference', proposal_row.proposal_reference,
      'status', proposal_row.status,
      'decided_at', proposal_row.decided_at
    )
  );
end;
$$;

revoke all on function public.customer_choose_and_schedule_requirement_provider(uuid,uuid,date,time without time zone,text) from public, anon;
grant execute on function public.customer_choose_and_schedule_requirement_provider(uuid,uuid,date,time without time zone,text) to authenticated;
