-- Repeated recurring recovery + selected-weekday regression E2E verification.
-- NON-PRODUCTION ONLY. Run against the Takeitesee test Supabase project.
-- The script reuses one approved active provider service, creates fixture rows only inside
-- this transaction, performs two real same-sequence recoveries, verifies provider attempt #2,
-- verifies selected-weekday + interval-week rejection, and rolls every fixture row back.

begin;

do $$
declare
  v_service public.services%rowtype;
  v_provider_user uuid;
  v_customer_user uuid;
  v_category_id uuid;
  v_location_id uuid;
  v_timezone text;
  v_day date;
  v_time time without time zone;
  v_second_day date;
  v_off_interval_day date;
  v_wrong_weekday_day date;
  v_requirement_id uuid:=gen_random_uuid();
  v_proposal_id uuid:=gen_random_uuid();
  v_original_booking_id uuid:=gen_random_uuid();
  v_original_job_id uuid:=gen_random_uuid();
  v_tag text:=replace(gen_random_uuid()::text,'-','');
  v_first jsonb;
  v_second jsonb;
  v_first_booking_id uuid;
  v_first_job_id uuid;
  v_second_booking_id uuid;
  v_second_job_id uuid;
  v_context jsonb;
  v_off_interval_blocked boolean:=false;
  v_wrong_weekday_blocked boolean:=false;
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
  if not found then raise exception 'Repeated recovery E2E requires one active provider service.'; end if;

  if v_service.provider_type::text='business' then
    select owner_user_id into v_provider_user from public.businesses where id=v_service.business_id;
  else
    select user_id into v_provider_user from public.professional_profiles where id=v_service.professional_id;
  end if;
  select u.id into v_customer_user from public.users u where u.id<>v_provider_user order by u.id limit 1;
  select id into v_category_id from public.platform_categories where active=true order by created_at,id limit 1;
  select id into v_location_id from public.platform_locations where active=true order by created_at,id limit 1;
  if v_customer_user is null or v_category_id is null or v_location_id is null then
    raise exception 'Repeated recovery E2E fixture prerequisites are unavailable.';
  end if;

  select coalesce(nullif(sa.timezone,''),'Asia/Kolkata') into v_timezone
  from (select 1) q
  left join public.service_availability sa on sa.service_id=v_service.id;

  select gs::date,w.start_time into v_day,v_time
  from generate_series(current_date+7,current_date+50,interval '1 day') gs
  join public.service_availability_windows w
    on w.service_id=v_service.id
   and w.day_of_week=extract(dow from gs)::smallint
  where extract(dow from gs)::smallint between 1 and 4
    and (gs::date::timestamp+w.end_time)>=(gs::date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes))
    and exists(
      select 1 from public.service_availability_windows w2
      where w2.service_id=v_service.id
        and w2.day_of_week=extract(dow from (gs::date+14))::smallint
        and w2.start_time<=w.start_time
        and w2.end_time>=w.start_time+make_interval(mins=>v_service.duration_minutes)
    )
    and not exists(
      select 1 from public.service_availability_blackouts x
      where x.service_id=v_service.id
        and x.starts_at<((gs::date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes)) at time zone v_timezone)
        and x.ends_at>((gs::date::timestamp+w.start_time) at time zone v_timezone)
    )
    and not exists(
      select 1 from public.service_availability_blackouts x
      where x.service_id=v_service.id
        and x.starts_at<(((gs::date+14)::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes)) at time zone v_timezone)
        and x.ends_at>(((gs::date+14)::timestamp+w.start_time) at time zone v_timezone)
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
    and not exists(
      select 1 from public.bookings b
      where b.booking_date=gs::date+14
        and b.status in ('pending','confirmed','rescheduled')
        and (
          (v_service.provider_type::text='business' and b.business_id=v_service.business_id)
          or
          (v_service.provider_type::text='professional' and b.professional_id=v_service.professional_id)
        )
        and (b.booking_date::timestamp+b.start_time)<((gs::date+14)::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes))
        and (b.booking_date::timestamp+b.start_time+make_interval(mins=>b.duration_minutes))>((gs::date+14)::timestamp+w.start_time)
    )
  order by gs,w.start_time
  limit 1;
  if v_day is null then raise exception 'Repeated recovery E2E could not find two valid interval slots.'; end if;

  v_second_day:=v_day+14;
  v_off_interval_day:=v_day+21;
  v_wrong_weekday_day:=v_day+22;

  insert into public.customer_requirements(
    id,requirement_reference,idempotency_key,customer_id,category_id,location_id,title,description,
    service_mode,budget_type,currency,needed_by,status,preferred_start_time,expected_duration_minutes,
    schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,recurrence_weekdays
  ) values (
    v_requirement_id,
    'TIS-E2E-RW-'||upper(substr(v_tag,1,12)),
    'repeat-weekday-e2e-'||v_tag,
    v_customer_user,v_category_id,v_location_id,
    'Repeated recovery weekday E2E',
    'Synthetic rolled-back weekly recurring requirement used to verify repeated same-sequence recovery and selected-weekday interval enforcement.',
    'onsite','negotiable',v_service.currency,v_day,'open',v_time,v_service.duration_minutes,
    'recurring','weekly',2,3,array[extract(dow from v_day)::smallint]
  );

  insert into public.requirement_proposals(
    id,proposal_reference,requirement_id,provider_user_id,service_id,amount_minor,currency,message,
    estimated_start_date,status,decided_at,pricing_basis
  ) values (
    v_proposal_id,
    'TIS-E2E-RP-'||upper(substr(v_tag,1,12)),
    v_requirement_id,v_provider_user,v_service.id,10000,v_service.currency,
    'Synthetic accepted proposal for repeated recovery weekday verification.',
    v_day,'accepted',now(),'per_occurrence'
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
    'TIS-E2E-RB-'||upper(substr(v_tag,1,12)),
    'requirement-job:'||v_requirement_id::text||':1',
    v_customer_user,v_service.id,v_service.provider_type,v_service.professional_id,v_service.business_id,
    v_service.name,v_day,v_time,v_timezone,v_service.duration_minutes,
    coalesce(nullif(v_service.location,''),'E2E verification'),
    'Synthetic original cancelled occurrence.',100,v_service.currency,'cancelled','unpaid','unselected'
  );
  insert into public.marketplace_requirement_jobs(
    id,requirement_id,proposal_id,booking_id,sequence_no,state,created_by
  ) values (
    v_original_job_id,v_requirement_id,v_proposal_id,v_original_booking_id,1,'cancelled',v_customer_user
  );

  perform set_config('request.jwt.claims',json_build_object('sub',v_customer_user,'role','authenticated')::text,true);

  v_first:=public.customer_retry_requirement_occurrence(v_requirement_id,v_day,v_time,'Repeated recovery attempt one');
  v_first_booking_id:=nullif(v_first#>>'{booking,id}','')::uuid;
  v_first_job_id:=nullif(v_first#>>'{job,id}','')::uuid;
  if v_first_booking_id is null or v_first_job_id is null or (v_first#>>'{job,sequence_no}')::int<>1 then
    raise exception 'First repeated recovery attempt failed.';
  end if;

  update public.bookings set status='cancelled',updated_at=now() where id=v_first_booking_id;
  update public.marketplace_requirement_jobs set state='cancelled',updated_at=now() where id=v_first_job_id;

  v_second:=public.customer_retry_requirement_occurrence(v_requirement_id,v_second_day,v_time,'Repeated recovery attempt two');
  v_second_booking_id:=nullif(v_second#>>'{booking,id}','')::uuid;
  v_second_job_id:=nullif(v_second#>>'{job,id}','')::uuid;
  if v_second_booking_id is null or v_second_job_id is null or (v_second#>>'{job,sequence_no}')::int<>1 then
    raise exception 'Second repeated recovery attempt failed or advanced sequence.';
  end if;

  select count(*) into v_recovery_count
  from public.requirement_occurrence_recoveries r
  where r.requirement_id=v_requirement_id and r.sequence_no=1 and r.status='completed';
  if v_recovery_count<>2 then raise exception 'Repeated recovery audit count mismatch: %',v_recovery_count; end if;

  if not exists(
    select 1 from public.requirement_occurrence_recoveries r
    where r.requirement_id=v_requirement_id
      and r.prior_booking_id=v_original_booking_id
      and r.replacement_booking_id=v_first_booking_id
      and r.status='completed'
  ) then raise exception 'First recovery audit chain is missing.'; end if;

  if not exists(
    select 1 from public.requirement_occurrence_recoveries r
    where r.requirement_id=v_requirement_id
      and r.prior_booking_id=v_first_booking_id
      and r.replacement_booking_id=v_second_booking_id
      and r.status='completed'
  ) then raise exception 'Second recovery audit chain is missing.'; end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_provider_user,'role','authenticated')::text,true);
  v_context:=public.provider_get_booking_requirement_context(v_second_booking_id);
  if coalesce((v_context#>>'{recovery,attempt_number}')::int,0)<>2 then
    raise exception 'Provider recovery attempt number is not 2.';
  end if;
  if nullif(v_context#>>'{recovery,prior_booking_id}','')::uuid<>v_first_booking_id then
    raise exception 'Provider second recovery prior booking mismatch.';
  end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_customer_user,'role','authenticated')::text,true);
  update public.bookings set status='cancelled',updated_at=now() where id=v_second_booking_id;
  update public.marketplace_requirement_jobs set state='cancelled',updated_at=now() where id=v_second_job_id;

  begin
    perform public.customer_retry_requirement_occurrence(v_requirement_id,v_off_interval_day,v_time,'Off interval week must fail');
  exception when others then
    if sqlerrm='The selected booking date is outside the recurring interval week.' then
      v_off_interval_blocked:=true;
    else
      raise;
    end if;
  end;
  if not v_off_interval_blocked then raise exception 'Off-interval selected weekday was not blocked.'; end if;

  begin
    perform public.customer_retry_requirement_occurrence(v_requirement_id,v_wrong_weekday_day,v_time,'Wrong weekday must fail');
  exception when others then
    if sqlerrm='The selected booking date must match one of the recurring weekdays.' then
      v_wrong_weekday_blocked:=true;
    else
      raise;
    end if;
  end;
  if not v_wrong_weekday_blocked then raise exception 'Non-selected weekday was not blocked.'; end if;

  select count(*) into v_recovery_count
  from public.requirement_occurrence_recoveries r
  where r.requirement_id=v_requirement_id and r.sequence_no=1 and r.status='completed';
  if v_recovery_count<>2 then raise exception 'Rejected recovery attempts left audit residue.'; end if;
  if not exists(
    select 1 from public.marketplace_requirement_jobs j
    where j.id=v_second_job_id and j.requirement_id=v_requirement_id and j.sequence_no=1 and j.state='cancelled'
  ) then raise exception 'Rejected retry changed the current failed job.'; end if;

  perform set_config('tis.repeat_recovery_e2e.same_sequence','true',true);
  perform set_config('tis.repeat_recovery_e2e.attempts',v_recovery_count::text,true);
  perform set_config('tis.repeat_recovery_e2e.provider_attempt',(v_context#>>'{recovery,attempt_number}'),true);
  perform set_config('tis.repeat_recovery_e2e.interval_blocked',v_off_interval_blocked::text,true);
  perform set_config('tis.repeat_recovery_e2e.weekday_blocked',v_wrong_weekday_blocked::text,true);
end $$;

select
  current_setting('tis.repeat_recovery_e2e.same_sequence',true)::boolean as same_sequence_preserved,
  current_setting('tis.repeat_recovery_e2e.attempts',true)::int as completed_recovery_attempts,
  current_setting('tis.repeat_recovery_e2e.provider_attempt',true)::int as provider_attempt_number,
  current_setting('tis.repeat_recovery_e2e.interval_blocked',true)::boolean as off_interval_week_blocked,
  current_setting('tis.repeat_recovery_e2e.weekday_blocked',true)::boolean as non_selected_weekday_blocked;

rollback;
