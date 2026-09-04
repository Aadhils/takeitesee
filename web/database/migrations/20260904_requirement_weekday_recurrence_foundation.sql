-- Universal Services Ecosystem: selected-weekday recurrence foundation.
-- Weekly requirements may optionally select multiple weekdays (0=Sunday ... 6=Saturday).
-- Existing weekly requirements keep legacy same-weekday behavior when recurrence_weekdays is null.

alter table public.customer_requirements
  add column if not exists recurrence_weekdays smallint[];

alter table public.customer_requirements
  drop constraint if exists customer_requirements_recurrence_weekdays_check;
alter table public.customer_requirements
  add constraint customer_requirements_recurrence_weekdays_check
  check (
    recurrence_weekdays is null
    or (
      schedule_pattern='recurring'
      and recurrence_frequency='weekly'
      and cardinality(recurrence_weekdays) between 1 and 7
      and recurrence_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
      and needed_by is not null
      and extract(dow from needed_by)::smallint = any(recurrence_weekdays)
    )
  );

-- Backward-compatible overload. The existing 17-argument function remains authoritative
-- for all existing validation and insertion behavior; this overload adds normalized weekdays.
create or replace function public.create_customer_requirement(
  requested_idempotency_key text,
  target_category_id uuid,
  target_location_id uuid,
  target_title text,
  target_description text,
  target_service_mode text,
  target_budget_type text,
  target_budget_min_minor bigint,
  target_budget_max_minor bigint,
  target_currency text,
  target_needed_by date,
  target_preferred_start_time time without time zone,
  target_expected_duration_minutes integer,
  target_schedule_pattern text,
  target_recurrence_frequency text,
  target_recurrence_interval smallint,
  target_recurrence_count integer,
  target_recurrence_weekdays smallint[]
)
returns public.customer_requirements
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_value public.customer_requirements%rowtype;
  existing_row public.customer_requirements%rowtype;
  normalized_weekdays smallint[];
  schedule_value text:=lower(btrim(coalesce(target_schedule_pattern,'one_time')));
  frequency_value text:=nullif(lower(btrim(coalesce(target_recurrence_frequency,''))),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  if target_recurrence_weekdays is not null then
    select array_agg(day_value order by day_value)
    into normalized_weekdays
    from (
      select distinct unnest(target_recurrence_weekdays)::smallint as day_value
    ) days;

    if schedule_value<>'recurring' or frequency_value<>'weekly' then
      raise exception 'Selected weekdays are available only for weekly recurring requirements.';
    end if;
    if normalized_weekdays is null or cardinality(normalized_weekdays)<1 or cardinality(normalized_weekdays)>7
       or not (normalized_weekdays <@ array[0,1,2,3,4,5,6]::smallint[]) then
      raise exception 'Recurring weekdays must contain valid weekday values from 0 to 6.';
    end if;
    if target_needed_by is null or not (extract(dow from target_needed_by)::smallint = any(normalized_weekdays)) then
      raise exception 'The first service date must match one of the selected weekdays.';
    end if;
  end if;

  select * into existing_row
  from public.customer_requirements
  where customer_id=auth.uid()
    and idempotency_key=btrim(coalesce(requested_idempotency_key,''))
  limit 1;

  if found then
    if existing_row.recurrence_weekdays is distinct from normalized_weekdays then
      raise exception 'Requirement idempotency key already exists with different weekday settings.';
    end if;
    return existing_row;
  end if;

  row_value:=public.create_customer_requirement(
    requested_idempotency_key,
    target_category_id,
    target_location_id,
    target_title,
    target_description,
    target_service_mode,
    target_budget_type,
    target_budget_min_minor,
    target_budget_max_minor,
    target_currency,
    target_needed_by,
    target_preferred_start_time,
    target_expected_duration_minutes,
    target_schedule_pattern,
    target_recurrence_frequency,
    target_recurrence_interval,
    target_recurrence_count
  );

  if normalized_weekdays is not null then
    update public.customer_requirements
    set recurrence_weekdays=normalized_weekdays,
        updated_at=now()
    where id=row_value.id
    returning * into row_value;
  end if;

  return row_value;
end;
$$;

revoke all on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date,time without time zone,integer,text,text,smallint,integer,smallint[]) from public,anon;
grant execute on function public.create_customer_requirement(text,uuid,uuid,text,text,text,text,bigint,bigint,text,date,time without time zone,integer,text,text,smallint,integer,smallint[]) to authenticated,service_role;

-- Internal schedule helper shared by the customer occurrence plan and sequential booking orchestration.
create or replace function public.requirement_planned_occurrence_date(
  target_requirement_id uuid,
  target_sequence integer
)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  requirement_row public.customer_requirements%rowtype;
  planned_date date;
begin
  if target_sequence is null or target_sequence<1 then return null; end if;

  select * into requirement_row
  from public.customer_requirements
  where id=target_requirement_id;
  if not found or requirement_row.needed_by is null then return null; end if;

  if requirement_row.schedule_pattern<>'recurring' then
    return case when target_sequence=1 then requirement_row.needed_by else null end;
  end if;

  if target_sequence>coalesce(requirement_row.recurrence_count,0) then return null; end if;

  if requirement_row.recurrence_frequency='daily' then
    return requirement_row.needed_by + ((target_sequence-1)*coalesce(requirement_row.recurrence_interval,1));
  elsif requirement_row.recurrence_frequency='monthly' then
    return (requirement_row.needed_by + make_interval(months=>(target_sequence-1)*coalesce(requirement_row.recurrence_interval,1)))::date;
  elsif requirement_row.recurrence_frequency='weekly' and requirement_row.recurrence_weekdays is null then
    return requirement_row.needed_by + ((target_sequence-1)*7*coalesce(requirement_row.recurrence_interval,1));
  elsif requirement_row.recurrence_frequency='weekly' then
    select candidate_date::date into planned_date
    from generate_series(
      requirement_row.needed_by::timestamp,
      (requirement_row.needed_by + ((coalesce(requirement_row.recurrence_count,1)+1)*7*coalesce(requirement_row.recurrence_interval,1)))::timestamp,
      interval '1 day'
    ) candidate(candidate_date)
    where (
      ((candidate_date::date-requirement_row.needed_by)/7) % coalesce(requirement_row.recurrence_interval,1)=0
      and extract(dow from candidate_date)::smallint = any(requirement_row.recurrence_weekdays)
    )
    order by candidate_date
    offset target_sequence-1
    limit 1;
    return planned_date;
  end if;

  return null;
end;
$$;

revoke all on function public.requirement_planned_occurrence_date(uuid,integer) from public,anon,authenticated;
grant execute on function public.requirement_planned_occurrence_date(uuid,integer) to service_role;

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
    'recurrence_weekdays',requirement_row.recurrence_weekdays,
    'occurrence_count',occurrence_total,
    'pricing_basis',coalesce(proposal_row.pricing_basis,'per_occurrence'),
    'quote_amount_minor',proposal_row.amount_minor,
    'currency',proposal_row.currency,
    'occurrences',coalesce(jsonb_agg(jsonb_build_object(
      'sequence_no',series.sequence_no,
      'scheduled_date',public.requirement_planned_occurrence_date(requirement_row.id,series.sequence_no),
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

create or replace function public.customer_create_requirement_job(
  target_requirement_id uuid,
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
  requirement_row public.customer_requirements%rowtype;
  proposal_row public.requirement_proposals%rowtype;
  service_row public.services%rowtype;
  latest_job public.marketplace_requirement_jobs%rowtype;
  availability_mode text;
  timezone_value text;
  provider_user_id uuid;
  notes_value text:=nullif(btrim(coalesce(requested_notes,'')),'');
  sequence_value integer;
  occurrence_total integer:=1;
  occurrence_duration integer;
  occurrence_amount_minor bigint;
  base_amount_minor bigint;
  planned_date date;
  booking_uuid uuid:=gen_random_uuid();
  job_row public.marketplace_requirement_jobs%rowtype;
  booking_row public.bookings%rowtype;
  requested_start_local timestamp without time zone;
  requested_end_local timestamp without time zone;
  requested_start_at timestamptz;
  requested_end_at timestamptz;
  quoted_price_value numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if requested_booking_date is null or requested_start_time is null then raise exception 'Booking date and time are required.'; end if;
  if notes_value is not null and char_length(notes_value)>1000 then raise exception 'Job notes must be 1000 characters or fewer.'; end if;

  select * into requirement_row
  from public.customer_requirements
  where id=target_requirement_id
  for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if requirement_row.customer_id<>auth.uid() then raise exception 'You can create a service job only for your own requirement.'; end if;
  if requirement_row.status<>'awarded' or requirement_row.accepted_proposal_id is null then
    raise exception 'A service job can be created only after a provider proposal is accepted.';
  end if;

  select * into proposal_row
  from public.requirement_proposals
  where id=requirement_row.accepted_proposal_id
    and requirement_id=requirement_row.id
    and status='accepted'
  for share;
  if not found then raise exception 'The accepted proposal is unavailable.'; end if;

  if exists(
    select 1 from public.marketplace_requirement_jobs
    where requirement_id=requirement_row.id
      and state in ('active','service_completed')
  ) then
    raise exception 'This requirement already has an active service job. Open the existing booking to reschedule or continue it.';
  end if;

  select * into latest_job
  from public.marketplace_requirement_jobs
  where requirement_id=requirement_row.id
  order by sequence_no desc
  limit 1;
  if found and latest_job.state<>'fulfilled' then
    raise exception 'The previous occurrence must be fully completed and settled before the next occurrence can be scheduled.';
  end if;

  select coalesce(max(sequence_no),0)+1 into sequence_value
  from public.marketplace_requirement_jobs
  where requirement_id=requirement_row.id;

  if requirement_row.schedule_pattern='recurring' then
    occurrence_total:=coalesce(requirement_row.recurrence_count,0);
    if occurrence_total<2 then raise exception 'Recurring requirement occurrence count is invalid.'; end if;
    if sequence_value>occurrence_total then raise exception 'All recurring service occurrences have already been created.'; end if;
    if requirement_row.needed_by is null then raise exception 'Recurring requirement first occurrence date is unavailable.'; end if;

    planned_date:=public.requirement_planned_occurrence_date(requirement_row.id,sequence_value);
    if planned_date is null then raise exception 'Recurring requirement schedule is invalid.'; end if;
    if requested_booking_date<planned_date then
      raise exception 'This occurrence cannot be scheduled before its planned date.';
    end if;
  else
    if sequence_value>1 then raise exception 'This one-time requirement already has a service job.'; end if;
    planned_date:=requirement_row.needed_by;
  end if;

  select * into service_row
  from public.services
  where id=proposal_row.service_id and active=true and status='active'
  for share;
  if not found then raise exception 'The selected provider service is no longer active.'; end if;

  if service_row.provider_type::text='business' then
    select owner_user_id into provider_user_id from public.businesses where id=service_row.business_id;
  else
    select user_id into provider_user_id from public.professional_profiles where id=service_row.professional_id;
  end if;
  if provider_user_id is null or provider_user_id<>proposal_row.provider_user_id then
    raise exception 'The accepted proposal no longer matches the selected provider service.';
  end if;
  if service_row.duration_minutes is null or service_row.duration_minutes<=0 then raise exception 'Service duration is not configured.'; end if;
  if proposal_row.amount_minor<=0 then raise exception 'The accepted proposal amount is invalid.'; end if;
  if proposal_row.currency not in ('INR','USD') then raise exception 'The accepted proposal currency is unsupported.'; end if;

  occurrence_duration:=case
    when requirement_row.schedule_pattern='recurring' then coalesce(requirement_row.expected_duration_minutes,service_row.duration_minutes)
    else service_row.duration_minutes
  end;
  if occurrence_duration is null or occurrence_duration<=0 then raise exception 'Occurrence duration is invalid.'; end if;

  occurrence_amount_minor:=proposal_row.amount_minor;
  if requirement_row.schedule_pattern='recurring' and proposal_row.pricing_basis='whole_requirement' then
    base_amount_minor:=proposal_row.amount_minor/occurrence_total;
    if base_amount_minor<=0 then raise exception 'Whole-requirement quote is too small to allocate across all occurrences.'; end if;
    occurrence_amount_minor:=case
      when sequence_value=occurrence_total then proposal_row.amount_minor-(base_amount_minor*(occurrence_total-1))
      else base_amount_minor
    end;
  end if;

  select coalesce(sa.mode::text,'on_request'),coalesce(nullif(sa.timezone,''),'Asia/Kolkata')
  into availability_mode,timezone_value
  from (select 1) seed
  left join public.service_availability sa on sa.service_id=service_row.id;

  requested_start_local:=requested_booking_date::timestamp + requested_start_time;
  requested_end_local:=requested_start_local + make_interval(mins=>occurrence_duration);
  requested_start_at:=requested_start_local at time zone timezone_value;
  requested_end_at:=requested_end_local at time zone timezone_value;

  if requested_start_at<=now() then raise exception 'Choose a future booking time.'; end if;

  if availability_mode='scheduled' then
    if not exists(
      select 1 from public.service_availability_windows w
      where w.service_id=service_row.id
        and w.day_of_week=extract(dow from requested_booking_date)::smallint
        and (requested_booking_date::timestamp+w.start_time)<=requested_start_local
        and (requested_booking_date::timestamp+w.end_time)>=requested_end_local
    ) then
      raise exception 'The selected time is outside the provider availability window.';
    end if;
  else
    if requested_start_time<time '09:00' or requested_end_local>(requested_booking_date::timestamp+time '18:00') then
      raise exception 'The selected time is outside the provider booking hours.';
    end if;
  end if;

  if exists(
    select 1 from public.service_availability_blackouts x
    where x.service_id=service_row.id
      and x.starts_at<requested_end_at
      and x.ends_at>requested_start_at
  ) then
    raise exception 'The selected time is blocked by the provider.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(proposal_row.provider_user_id::text||':'||requested_booking_date::text,0));

  if exists(
    select 1 from public.bookings b
    where b.booking_date=requested_booking_date
      and b.status in ('pending','confirmed','rescheduled')
      and (
        (service_row.provider_type::text='business' and b.business_id=service_row.business_id)
        or
        (service_row.provider_type::text='professional' and b.professional_id=service_row.professional_id)
      )
      and (b.booking_date::timestamp+b.start_time)<requested_end_local
      and (b.booking_date::timestamp+b.start_time+make_interval(mins=>b.duration_minutes))>requested_start_local
  ) then
    raise exception 'The provider already has a booking during the selected time.';
  end if;

  quoted_price_value:=occurrence_amount_minor::numeric/100;

  insert into public.bookings(
    id,booking_reference,idempotency_key,customer_id,service_id,provider_type,professional_id,business_id,
    service_name_snapshot,booking_date,start_time,timezone,duration_minutes,location,customer_notes,
    quoted_price,currency,status,payment_status,payment_method
  ) values (
    booking_uuid,
    'TIS-RQ-'||to_char(requested_booking_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    'requirement-job:'||requirement_row.id::text||':'||sequence_value::text,
    requirement_row.customer_id,service_row.id,service_row.provider_type,service_row.professional_id,service_row.business_id,
    service_row.name,requested_booking_date,requested_start_time,timezone_value,occurrence_duration,
    coalesce(nullif(service_row.location,''),'Service location'),notes_value,quoted_price_value,proposal_row.currency,
    'pending','unpaid','unselected'
  ) returning * into booking_row;

  insert into public.marketplace_requirement_jobs(requirement_id,proposal_id,booking_id,sequence_no,state,created_by)
  values(requirement_row.id,proposal_row.id,booking_row.id,sequence_value,'active',auth.uid())
  returning * into job_row;

  return jsonb_build_object(
    'job',jsonb_build_object(
      'id',job_row.id,'requirement_id',job_row.requirement_id,'proposal_id',job_row.proposal_id,
      'booking_id',job_row.booking_id,'sequence_no',job_row.sequence_no,'state',job_row.state,'created_at',job_row.created_at,
      'planned_date',planned_date,'occurrence_count',occurrence_total
    ),
    'booking',jsonb_build_object(
      'id',booking_row.id,'booking_reference',booking_row.booking_reference,'status',booking_row.status,
      'payment_status',booking_row.payment_status,'payment_method',booking_row.payment_method,
      'booking_date',booking_row.booking_date,'start_time',booking_row.start_time,'timezone',booking_row.timezone,
      'duration_minutes',booking_row.duration_minutes,'location',booking_row.location,
      'quoted_price',booking_row.quoted_price,'currency',booking_row.currency,'service_name',booking_row.service_name_snapshot
    )
  );
end;
$$;

revoke all on function public.customer_create_requirement_job(uuid,date,time without time zone,text) from public,anon;
grant execute on function public.customer_create_requirement_job(uuid,date,time without time zone,text) to authenticated;
