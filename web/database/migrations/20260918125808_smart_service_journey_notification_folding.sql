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
  booking_uuid uuid;
  conversation_uuid uuid;
  provider_name text;
  service_name text;
  provider_proposal_target text;
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

  booking_uuid := nullif(job_payload #>> '{booking,id}', '')::uuid;
  if booking_uuid is null then
    raise exception 'Scheduled booking was not returned.';
  end if;

  select id
    into conversation_uuid
    from public.marketplace_conversations
   where requirement_id = target_requirement_id;

  provider_name := public.marketplace_safe_display_name(proposal_row.provider_user_id);
  service_name := coalesce(nullif(job_payload #>> '{booking,service_name}', ''), 'Service');
  provider_proposal_target := '/provider/leads?requirement=' || target_requirement_id::text || '&proposal=' || target_proposal_id::text;

  delete from public.notifications
   where event_type = 'booking_created'
     and booking_id = booking_uuid
     and recipient_user_id in (auth.uid(), proposal_row.provider_user_id);

  if conversation_uuid is not null then
    delete from public.notifications
     where event_type = 'requirement_chat_opened'
       and conversation_id = conversation_uuid
       and recipient_user_id in (auth.uid(), proposal_row.provider_user_id);
  end if;

  delete from public.notifications
   where event_type = 'requirement_proposal_accepted'
     and recipient_user_id = proposal_row.provider_user_id
     and target_path = provider_proposal_target;

  insert into public.notifications(
    recipient_user_id,
    booking_id,
    conversation_id,
    event_type,
    title,
    body,
    target_path
  ) values (
    auth.uid(),
    booking_uuid,
    conversation_uuid,
    'booking_created',
    'Service request sent',
    service_name || ' with ' || provider_name || ' is requested for ' ||
      requested_booking_date::text || ' at ' || left(requested_start_time::text, 5) ||
      '. Waiting for provider confirmation.',
    '/requirements/' || target_requirement_id::text
  );

  if proposal_row.provider_user_id is distinct from auth.uid() then
    insert into public.notifications(
      recipient_user_id,
      booking_id,
      conversation_id,
      event_type,
      title,
      body,
      target_path
    ) values (
      proposal_row.provider_user_id,
      booking_uuid,
      conversation_uuid,
      'booking_created',
      'Action needed: confirm service request',
      'A customer chose you for ' || service_name || ' on ' ||
        requested_booking_date::text || ' at ' || left(requested_start_time::text, 5) ||
        '. Review and confirm the booking.',
      '/provider/bookings/' || booking_uuid::text
    );
  end if;

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
