-- Universal Services Ecosystem: derive a customer-safe occurrence plan before recurring booking orchestration.
-- This is a read model only; it does not create bookings or change payment/closeout behavior.

create or replace function public.get_customer_requirement_occurrence_plan(target_requirement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requirement_row public.customer_requirements%rowtype;
  proposal_row public.requirement_proposals%rowtype;
  occurrence_total integer;
  result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Customer authentication required.'; end if;

  select * into requirement_row
  from public.customer_requirements
  where id=target_requirement_id;

  if not found then raise exception 'Requirement was not found.'; end if;
  if requirement_row.customer_id<>auth.uid() then
    raise exception 'You can view the occurrence plan only for your own requirement.';
  end if;

  if requirement_row.accepted_proposal_id is not null then
    select * into proposal_row
    from public.requirement_proposals
    where id=requirement_row.accepted_proposal_id
      and requirement_id=requirement_row.id;
  end if;

  occurrence_total:=case
    when requirement_row.schedule_pattern='recurring' then coalesce(requirement_row.recurrence_count,0)
    else 1
  end;

  if occurrence_total<=0 then occurrence_total:=1; end if;

  select jsonb_build_object(
    'schedule_pattern',requirement_row.schedule_pattern,
    'recurrence_frequency',requirement_row.recurrence_frequency,
    'recurrence_interval',requirement_row.recurrence_interval,
    'occurrence_count',occurrence_total,
    'pricing_basis',coalesce(proposal_row.pricing_basis,'per_occurrence'),
    'quote_amount_minor',proposal_row.amount_minor,
    'currency',proposal_row.currency,
    'occurrences',coalesce(jsonb_agg(jsonb_build_object(
      'sequence_no',series.sequence_no,
      'scheduled_date',case
        when requirement_row.needed_by is null then null
        when requirement_row.schedule_pattern<>'recurring' then requirement_row.needed_by
        when requirement_row.recurrence_frequency='daily' then requirement_row.needed_by + ((series.sequence_no-1)*coalesce(requirement_row.recurrence_interval,1))
        when requirement_row.recurrence_frequency='weekly' then requirement_row.needed_by + ((series.sequence_no-1)*7*coalesce(requirement_row.recurrence_interval,1))
        when requirement_row.recurrence_frequency='monthly' then (requirement_row.needed_by + make_interval(months=>(series.sequence_no-1)*coalesce(requirement_row.recurrence_interval,1)))::date
        else requirement_row.needed_by
      end,
      'preferred_start_time',requirement_row.preferred_start_time,
      'expected_duration_minutes',requirement_row.expected_duration_minutes,
      'job_id',job.id,
      'job_state',job.state,
      'booking_id',booking.id,
      'booking_reference',booking.booking_reference,
      'booking_status',booking.status,
      'booked_date',booking.booking_date,
      'booked_start_time',booking.start_time
    ) order by series.sequence_no),'[]'::jsonb)
  ) into result_value
  from generate_series(1,occurrence_total) as series(sequence_no)
  left join public.marketplace_requirement_jobs job
    on job.requirement_id=requirement_row.id and job.sequence_no=series.sequence_no
  left join public.bookings booking on booking.id=job.booking_id;

  return result_value;
end;
$$;

revoke all on function public.get_customer_requirement_occurrence_plan(uuid) from public,anon;
grant execute on function public.get_customer_requirement_occurrence_plan(uuid) to authenticated;
