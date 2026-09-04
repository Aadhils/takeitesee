-- Recovered recurring occurrence completion -> next occurrence advancement E2E verification.
-- NON-PRODUCTION ONLY. Run against the Takeitesee test Supabase project.
-- The script creates all requirement/booking fixtures inside one transaction and rolls them back.
-- Finance/payment notification/reconciliation triggers are temporarily disabled only around the
-- synthetic settled-completion state transition so this verifies the non-finance lifecycle path
-- without exercising Cashfree, refunds, payouts, settlement or reconciliation workflows.

begin;

do $$
declare
  v_service public.services%rowtype;
  v_provider_user uuid;
  v_customer_user uuid;
  v_category_id uuid;
  v_location_id uuid;
  v_timezone text;
  v_first_day date;
  v_first_time time without time zone;
  v_second_day date;
  v_second_time time without time zone;
  v_requirement_id uuid:=gen_random_uuid();
  v_proposal_id uuid:=gen_random_uuid();
  v_original_booking_id uuid:=gen_random_uuid();
  v_original_job_id uuid:=gen_random_uuid();
  v_tag text:=replace(gen_random_uuid()::text,'-','');
  v_recovery jsonb;
  v_recovery_booking_id uuid;
  v_recovery_job_id uuid;
  v_next jsonb;
  v_next_booking_id uuid;
  v_next_job_id uuid;
  v_recovered_context jsonb;
  v_next_context jsonb;
  v_recovery_count integer;
begin
  select s.* into v_service
  from public.services s
  where s.active=true and s.status='active'
    and (
      (s.provider_type::text='business' and exists(
        select 1 from public.businesses b where b.id=s.business_id and b.owner_user_id is not null
      ))
      or
      (s.provider_type::text='professional' and exists(
        select 1 from public.professional_profiles p where p.id=s.professional_id and p.user_id is not null
      ))
    )
  order by s.created_at,s.id
  limit 1;
  if not found then raise exception 'Advancement E2E requires one active provider service.'; end if;

  if v_service.provider_type::text='business' then
    select owner_user_id into v_provider_user from public.businesses where id=v_service.business_id;
  else
    select user_id into v_provider_user from public.professional_profiles where id=v_service.professional_id;
  end if;

  select u.id into v_customer_user from public.users u where u.id<>v_provider_user order by u.id limit 1;
  select id into v_category_id from public.platform_categories where active=true order by created_at,id limit 1;
  select id into v_location_id from public.platform_locations where active=true order by created_at,id limit 1;
  if v_customer_user is null or v_category_id is null or v_location_id is null then
    raise exception 'Advancement E2E fixture prerequisites are unavailable.';
  end if;

  select coalesce(nullif(sa.timezone,''),'Asia/Kolkata') into v_timezone
  from (select 1) q
  left join public.service_availability sa on sa.service_id=v_service.id;

  with candidates as (
    select gs::date as d,w.start_time
    from generate_series(current_date+7,current_date+70,interval '1 day') gs
    join public.service_availability_windows w
      on w.service_id=v_service.id
     and w.day_of_week=extract(dow from gs)::smallint
    where (gs::date::timestamp+w.end_time)>=(gs::date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes))
      and ((gs::date::timestamp+w.start_time) at time zone v_timezone)>now()
      and not exists(
        select 1 from public.service_availability_blackouts x
        where x.service_id=v_service.id
          and x.starts_at<((gs::date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes)) at time zone v_timezone)
          and x.ends_at>((gs::date::timestamp+w.start_time) at time zone v_timezone)
      )
      and not exists(
        select 1 from public.bookings b
        where b.booking_date=gs::date
          and b.status in ('pending','confirmed','rescheduled')
          and (
            (v_service.provider_type::text='business' and b.business_id=v_service.business_id)
            or
            (v_service.provider_type::text='professional' and b.professional_id=v_service.professional_id)
          )
          and (b.booking_date::timestamp+b.start_time)<(gs::date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes))
          and (b.booking_date::timestamp+b.start_time+make_interval(mins=>b.duration_minutes))>(gs::date::timestamp+w.start_time)
      )
  )
  select c1.d,c1.start_time,c2.d,c2.start_time
  into v_first_day,v_first_time,v_second_day,v_second_time
  from candidates c1
  join candidates c2 on c2.d>c1.d and c2.d<=c1.d+6
  order by c1.d,c1.start_time,c2.d,c2.start_time
  limit 1;
  if v_first_day is null or v_second_day is null then
    raise exception 'Advancement E2E could not find two selected-weekday slots in one recurrence week.';
  end if;

  insert into public.customer_requirements(
    id,requirement_reference,idempotency_key,customer_id,category_id,location_id,title,description,
    service_mode,budget_type,currency,needed_by,status,preferred_start_time,expected_duration_minutes,
    schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,recurrence_weekdays
  ) values (
    v_requirement_id,
    'TIS-E2E-ADV-'||upper(substr(v_tag,1,10)),
    'advancement-e2e-'||v_tag,
    v_customer_user,v_category_id,v_location_id,
    'Recovery advancement E2E',
    'Rolled-back recurring recovery completion and next occurrence advancement verification.',
    'onsite','negotiable',v_service.currency,v_first_day,'open',v_first_time,v_service.duration_minutes,
    'recurring','weekly',1,3,
    array[extract(dow from v_first_day)::smallint,extract(dow from v_second_day)::smallint]
  );

  insert into public.requirement_proposals(
    id,proposal_reference,requirement_id,provider_user_id,service_id,amount_minor,currency,message,
    estimated_start_date,status,decided_at,pricing_basis
  ) values (
    v_proposal_id,
    'TIS-E2E-AP-'||upper(substr(v_tag,1,10)),
    v_requirement_id,v_provider_user,v_service.id,10000,v_service.currency,
    'Synthetic accepted proposal for advancement E2E.',
    v_first_day,'accepted',now(),'per_occurrence'
  );

  update public.customer_requirements
  set status='awarded',accepted_proposal_id=v_proposal_id,awarded_at=now()
  where id=v_requirement_id;

  insert into public.bookings(
    id,booking_reference,idempotency_key,customer_id,service_id,provider_type,professional_id,business_id,
    service_name_snapshot,booking_date,start_time,timezone,duration_minutes,location,customer_notes,
    quoted_price,currency,status,payment_status,payment_method
  ) values (
    v_original_booking_id,
    'TIS-E2E-AB-'||upper(substr(v_tag,1,10)),
    'requirement-job:'||v_requirement_id::text||':1',
    v_customer_user,v_service.id,v_service.provider_type,v_service.professional_id,v_service.business_id,
    v_service.name,v_first_day,v_first_time,v_timezone,v_service.duration_minutes,
    coalesce(nullif(v_service.location,''),'E2E verification'),
    'Synthetic original cancelled occurrence.',100,v_service.currency,'cancelled','unpaid','unselected'
  );

  insert into public.marketplace_requirement_jobs(
    id,requirement_id,proposal_id,booking_id,sequence_no,state,created_by
  ) values (
    v_original_job_id,v_requirement_id,v_proposal_id,v_original_booking_id,1,'cancelled',v_customer_user
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',v_customer_user,'role','authenticated')::text,
    true
  );

  v_recovery:=public.customer_retry_requirement_occurrence(
    v_requirement_id,v_first_day,v_first_time,'Recovery before completion advancement'
  );
  v_recovery_booking_id:=nullif(v_recovery#>>'{booking,id}','')::uuid;
  v_recovery_job_id:=nullif(v_recovery#>>'{job,id}','')::uuid;
  if v_recovery_booking_id is null or (v_recovery#>>'{job,sequence_no}')::int<>1 then
    raise exception 'Recovery did not preserve sequence #1.';
  end if;

  -- Pre-settle the synthetic recovered booking without exercising finance-side trigger workflows.
  alter table public.bookings disable trigger bookings_reconcile_finance_settlement;
  alter table public.bookings disable trigger bookings_emit_payment_notifications;
  alter table public.bookings disable trigger bookings_log_payment_event_update;

  update public.bookings
  set status='completed',payment_status='paid',updated_at=now()
  where id=v_recovery_booking_id;

  alter table public.bookings enable trigger bookings_log_payment_event_update;
  alter table public.bookings enable trigger bookings_emit_payment_notifications;
  alter table public.bookings enable trigger bookings_reconcile_finance_settlement;

  if not exists(
    select 1 from public.marketplace_requirement_jobs j
    where j.id=v_recovery_job_id and j.state='service_completed'
  ) then
    raise exception 'Recovered occurrence did not enter service_completed before customer confirmation.';
  end if;

  perform public.customer_confirm_service_completion(v_recovery_booking_id);

  if not exists(
    select 1 from public.marketplace_requirement_jobs j
    where j.id=v_recovery_job_id and j.sequence_no=1 and j.state='fulfilled'
  ) then
    raise exception 'Customer confirmation did not fulfill recovered sequence #1.';
  end if;

  if not exists(
    select 1 from public.customer_requirements r
    where r.id=v_requirement_id and r.status='awarded'
  ) then
    raise exception 'Recurring requirement closed before all occurrences were fulfilled.';
  end if;

  select count(*) into v_recovery_count
  from public.requirement_occurrence_recoveries r
  where r.requirement_id=v_requirement_id and r.sequence_no=1 and r.status='completed';
  if v_recovery_count<>1 then raise exception 'Recovery audit changed during completion.'; end if;

  v_next:=public.customer_create_requirement_job(
    v_requirement_id,v_second_day,v_second_time,'Sequence two after recovered completion'
  );
  v_next_booking_id:=nullif(v_next#>>'{booking,id}','')::uuid;
  v_next_job_id:=nullif(v_next#>>'{job,id}','')::uuid;

  if v_next_booking_id is null or v_next_job_id is null then
    raise exception 'Next occurrence was not created.';
  end if;
  if (v_next#>>'{job,sequence_no}')::int<>2 then
    raise exception 'Next occurrence did not advance to sequence #2.';
  end if;
  if (v_next#>>'{job,planned_date}')::date<>v_second_day then
    raise exception 'Sequence #2 planned selected-weekday date mismatch.';
  end if;
  if (v_next#>>'{booking,booking_date}')::date<>v_second_day then
    raise exception 'Sequence #2 booking date mismatch.';
  end if;
  if exists(
    select 1 from public.marketplace_requirement_jobs j
    where j.requirement_id=v_requirement_id and j.sequence_no=3
  ) then
    raise exception 'Sequence #3 was created early.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',v_provider_user,'role','authenticated')::text,
    true
  );

  v_recovered_context:=public.provider_get_booking_requirement_context(v_recovery_booking_id);
  v_next_context:=public.provider_get_booking_requirement_context(v_next_booking_id);

  if coalesce((v_recovered_context#>>'{recovery,attempt_number}')::int,0)<>1 then
    raise exception 'Recovered sequence #1 provider context lost its recovery attempt.';
  end if;
  if (v_next_context->>'occurrence_number')::int<>2 then
    raise exception 'Provider sequence #2 occurrence context mismatch.';
  end if;
  if v_next_context->'recovery' is distinct from 'null'::jsonb then
    raise exception 'Normal sequence #2 incorrectly carries recovery context.';
  end if;

  select count(*) into v_recovery_count
  from public.requirement_occurrence_recoveries r
  where r.requirement_id=v_requirement_id and r.status='completed';
  if v_recovery_count<>1 then
    raise exception 'Recovery audit history changed after next occurrence creation.';
  end if;

  perform set_config('tis.advance_e2e.recovered_fulfilled','true',true);
  perform set_config('tis.advance_e2e.next_sequence',(v_next#>>'{job,sequence_no}'),true);
  perform set_config('tis.advance_e2e.next_planned_date',(v_next#>>'{job,planned_date}'),true);
  perform set_config('tis.advance_e2e.recovery_audit_count',v_recovery_count::text,true);
  perform set_config(
    'tis.advance_e2e.next_recovery_null',
    (v_next_context->'recovery' is null or v_next_context->'recovery'='null'::jsonb)::text,
    true
  );
end $$;

select
  current_setting('tis.advance_e2e.recovered_fulfilled',true)::boolean as recovered_sequence_fulfilled,
  current_setting('tis.advance_e2e.next_sequence',true)::int as next_sequence,
  current_setting('tis.advance_e2e.next_planned_date',true)::date as next_planned_date,
  current_setting('tis.advance_e2e.recovery_audit_count',true)::int as recovery_audit_count,
  current_setting('tis.advance_e2e.next_recovery_null',true)::boolean as next_occurrence_has_no_recovery_marker;

rollback;
