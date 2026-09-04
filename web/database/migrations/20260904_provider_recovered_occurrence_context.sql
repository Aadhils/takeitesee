-- Universal Services: expose audited recovery context on provider-owned requirement bookings.
-- Read-only context extension; recurrence orchestration and finance behavior are unchanged.

create or replace function public.provider_get_booking_requirement_context(target_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking_row public.bookings%rowtype;
  job_row public.marketplace_requirement_jobs%rowtype;
  requirement_row public.customer_requirements%rowtype;
  proposal_row public.requirement_proposals%rowtype;
  recovery_row public.requirement_occurrence_recoveries%rowtype;
  prior_booking_row public.bookings%rowtype;
  recovery_attempt integer;
  recovery_context jsonb := null;
  provider_user uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into booking_row from public.bookings where id=target_booking_id;
  if not found then return null; end if;

  if booking_row.provider_type::text='business' then
    select owner_user_id into provider_user from public.businesses where id=booking_row.business_id;
  else
    select user_id into provider_user from public.professional_profiles where id=booking_row.professional_id;
  end if;
  if provider_user is null or provider_user<>auth.uid() then raise exception 'Provider booking access is required.'; end if;

  select * into job_row from public.marketplace_requirement_jobs where booking_id=target_booking_id;
  if not found then return null; end if;
  select * into requirement_row from public.customer_requirements where id=job_row.requirement_id;
  if not found then return null; end if;
  select * into proposal_row from public.requirement_proposals where id=job_row.proposal_id;

  select * into recovery_row
  from public.requirement_occurrence_recoveries
  where replacement_booking_id=target_booking_id
    and status='completed'
  order by completed_at desc nulls last,created_at desc
  limit 1;

  if found then
    select * into prior_booking_row
    from public.bookings
    where id=recovery_row.prior_booking_id
      and provider_type=booking_row.provider_type
      and business_id is not distinct from booking_row.business_id
      and professional_id is not distinct from booking_row.professional_id;

    if found then
      select count(*)::integer into recovery_attempt
      from public.requirement_occurrence_recoveries
      where requirement_id=recovery_row.requirement_id
        and sequence_no=recovery_row.sequence_no
        and status='completed'
        and created_at<=recovery_row.created_at;

      recovery_context:=jsonb_build_object(
        'id',recovery_row.id,
        'attempt_number',greatest(coalesce(recovery_attempt,1),1),
        'prior_booking_id',prior_booking_row.id,
        'prior_booking_reference',prior_booking_row.booking_reference,
        'recovered_at',coalesce(recovery_row.completed_at,recovery_row.created_at)
      );
    end if;
  end if;

  return jsonb_build_object(
    'requirement_id', requirement_row.id,
    'requirement_title', requirement_row.title,
    'schedule_pattern', requirement_row.schedule_pattern,
    'occurrence_number', job_row.sequence_no,
    'occurrence_count', case when requirement_row.schedule_pattern='recurring' then requirement_row.recurrence_count else 1 end,
    'recurrence_frequency', requirement_row.recurrence_frequency,
    'recurrence_interval', requirement_row.recurrence_interval,
    'recurrence_weekdays', requirement_row.recurrence_weekdays,
    'pricing_basis', proposal_row.pricing_basis,
    'recovery', recovery_context
  );
end;
$$;

revoke all on function public.provider_get_booking_requirement_context(uuid) from public,anon;
grant execute on function public.provider_get_booking_requirement_context(uuid) to authenticated;
