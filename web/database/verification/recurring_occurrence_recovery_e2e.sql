-- Recurring occurrence recovery E2E verification.
-- NON-PRODUCTION ONLY. Run against the Takeitesee test Supabase project.
-- The script reuses one already-approved active provider service and auth-linked users,
-- creates requirement/recovery fixture rows only inside this transaction, exercises the real
-- customer retry + provider read RPCs, asserts safety invariants, and rolls everything back.
-- It does not activate or exercise Cashfree, refunds, payouts, settlement or reconciliation.

begin;

do $$
declare
  v_service public.services%rowtype;
  v_provider_user uuid;
  v_customer_user uuid;
  v_outsider_user uuid;
  v_category_id uuid;
  v_location_id uuid;
  v_timezone text;
  v_booking_day date;
  v_booking_time time without time zone;
  v_requirement_id uuid := gen_random_uuid();
  v_proposal_id uuid := gen_random_uuid();
  v_failed_booking_id uuid := gen_random_uuid();
  v_failed_job_id uuid := gen_random_uuid();
  v_run_tag text := replace(gen_random_uuid()::text,'-','');
  v_replacement jsonb;
  v_replacement_booking_id uuid;
  v_replacement_job_id uuid;
  v_provider_context jsonb;
  v_unauthorized_blocked boolean := false;
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
        select 1 from public.professional_profiles pp where pp.id=s.professional_id and pp.user_id is not null
      ))
    )
  order by s.created_at,s.id
  limit 1;
  if not found then raise exception 'E2E fixture requires one active provider service.'; end if;

  if v_service.provider_type::text='business' then
    select owner_user_id into v_provider_user from public.businesses where id=v_service.business_id;
  else
    select user_id into v_provider_user from public.professional_profiles where id=v_service.professional_id;
  end if;
  if v_provider_user is null then raise exception 'E2E active service has no provider owner.'; end if;

  select u.id into v_customer_user from public.users u where u.id<>v_provider_user order by u.id limit 1;
  select u.id into v_outsider_user from public.users u where u.id<>v_provider_user and u.id<>v_customer_user order by u.id limit 1;
  if v_customer_user is null or v_outsider_user is null then
    raise exception 'E2E fixture requires customer and outsider auth-linked users.';
  end if;

  select id into v_category_id from public.platform_categories where active=true order by created_at,id limit 1;
  select id into v_location_id from public.platform_locations where active=true order by created_at,id limit 1;
  if v_category_id is null or v_location_id is null then
    raise exception 'E2E fixture requires one active platform category and location.';
  end if;

  select coalesce(nullif(sa.timezone,''),'Asia/Kolkata') into v_timezone
  from (select 1) seed
  left join public.service_availability sa on sa.service_id=v_service.id;

  select candidate.d,candidate.start_time into v_booking_day,v_booking_time
  from (
    select gs::date as d,w.start_time
    from generate_series(current_date+7,current_date+90,interval '1 day') gs
    join public.service_availability_windows w
      on w.service_id=v_service.id
     and w.day_of_week=extract(dow from gs)::smallint
    where (gs::date::timestamp+w.end_time)>=(gs::date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes))
      and (gs::date::timestamp+w.start_time) at time zone v_timezone > now()
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
    order by gs,w.start_time
    limit 1
  ) candidate;
  if v_booking_day is null or v_booking_time is null then
    raise exception 'E2E fixture could not find an available provider window in the next 90 days.';
  end if;

  insert into public.customer_requirements(
    id,requirement_reference,idempotency_key,customer_id,category_id,location_id,title,description,
    service_mode,budget_type,currency,needed_by,status,preferred_start_time,expected_duration_minutes,
    schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count
  ) values (
    v_requirement_id,
    'TIS-E2E-RQ-'||upper(substr(v_run_tag,1,12)),
    'recovery-e2e-'||v_run_tag,
    v_customer_user,v_category_id,v_location_id,
    'Recovery E2E recurring service',
    'Synthetic recurring requirement used inside a rolled-back transaction to verify same-sequence recovery and provider replacement context.',
    'onsite','negotiable',v_service.currency,v_booking_day,'open',v_booking_time,v_service.duration_minutes,
    'recurring','daily',1,3
  );

  insert into public.requirement_proposals(
    id,proposal_reference,requirement_id,provider_user_id,service_id,amount_minor,currency,message,
    estimated_start_date,status,decided_at,pricing_basis
  ) values (
    v_proposal_id,
    'TIS-E2E-PR-'||upper(substr(v_run_tag,1,12)),
    v_requirement_id,v_provider_user,v_service.id,10000,v_service.currency,
    'Synthetic accepted proposal for the rolled-back recurring recovery end-to-end verification.',
    v_booking_day,'accepted',now(),'per_occurrence'
  );

  update public.customer_requirements
  set status='awarded',accepted_proposal_id=v_proposal_id,awarded_at=now()
  where id=v_requirement_id;

  insert into public.bookings(
    id,booking_reference,idempotency_key,customer_id,service_id,provider_type,professional_id,business_id,
    service_name_snapshot,booking_date,start_time,timezone,duration_minutes,location,customer_notes,
    quoted_price,currency,status,payment_status,payment_method
  ) values (
    v_failed_booking_id,
    'TIS-E2E-BK-'||upper(substr(v_run_tag,1,12)),
    'requirement-job:'||v_requirement_id::text||':1',
    v_customer_user,v_service.id,v_service.provider_type,v_service.professional_id,v_service.business_id,
    v_service.name,v_booking_day,v_booking_time,v_timezone,v_service.duration_minutes,
    coalesce(nullif(v_service.location,''),'E2E verification'),
    'Synthetic cancelled occurrence.',100,v_service.currency,'cancelled','unpaid','unselected'
  );

  insert into public.marketplace_requirement_jobs(
    id,requirement_id,proposal_id,booking_id,sequence_no,state,created_by
  ) values (
    v_failed_job_id,v_requirement_id,v_proposal_id,v_failed_booking_id,1,'cancelled',v_customer_user
  );

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',v_customer_user,'role','authenticated')::text,
    true
  );

  v_replacement:=public.customer_retry_requirement_occurrence(
    v_requirement_id,v_booking_day,v_booking_time,'Recovery E2E replacement'
  );
  v_replacement_booking_id:=nullif(v_replacement#>>'{booking,id}','')::uuid;
  v_replacement_job_id:=nullif(v_replacement#>>'{job,id}','')::uuid;

  if v_replacement_booking_id is null or v_replacement_job_id is null then
    raise exception 'Recovery did not return replacement identifiers.';
  end if;
  if v_replacement_booking_id=v_failed_booking_id then
    raise exception 'Recovery reused the prior booking.';
  end if;
  if (v_replacement#>>'{job,sequence_no}')::integer<>1 then
    raise exception 'Recovery advanced the occurrence sequence.';
  end if;

  if not exists(
    select 1
    from public.requirement_occurrence_recoveries r
    where r.requirement_id=v_requirement_id
      and r.sequence_no=1
      and r.prior_booking_id=v_failed_booking_id
      and r.replacement_booking_id=v_replacement_booking_id
      and r.replacement_job_id=v_replacement_job_id
      and r.status='completed'
  ) then
    raise exception 'Completed recovery audit linkage is missing.';
  end if;

  if not exists(
    select 1 from public.bookings b
    where b.id=v_failed_booking_id and b.status='cancelled' and b.payment_status='unpaid'
  ) then
    raise exception 'Prior booking was not preserved.';
  end if;

  if not exists(
    select 1 from public.bookings b
    where b.id=v_replacement_booking_id and b.status='pending' and b.payment_status='unpaid'
  ) then
    raise exception 'Replacement booking payment/status changed unexpectedly.';
  end if;

  if exists(
    select 1 from public.marketplace_requirement_jobs j
    where j.requirement_id=v_requirement_id and j.sequence_no<>1
  ) then
    raise exception 'Unexpected later occurrence was created.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',v_provider_user,'role','authenticated')::text,
    true
  );
  v_provider_context:=public.provider_get_booking_requirement_context(v_replacement_booking_id);

  if v_provider_context is null then raise exception 'Provider replacement context was not returned.'; end if;
  if (v_provider_context->>'occurrence_number')::integer<>1 then raise exception 'Provider context sequence mismatch.'; end if;
  if nullif(v_provider_context#>>'{recovery,prior_booking_id}','')::uuid<>v_failed_booking_id then
    raise exception 'Provider recovery prior booking mismatch.';
  end if;
  if coalesce((v_provider_context#>>'{recovery,attempt_number}')::integer,0)<>1 then
    raise exception 'Provider recovery attempt mismatch.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',v_outsider_user,'role','authenticated')::text,
    true
  );
  begin
    perform public.provider_get_booking_requirement_context(v_replacement_booking_id);
  exception when others then
    if sqlerrm='Provider booking access is required.' then
      v_unauthorized_blocked:=true;
    else
      raise;
    end if;
  end;
  if not v_unauthorized_blocked then raise exception 'Unrelated provider was not blocked.'; end if;

  perform set_config('tis.recovery_e2e.requirement_id',v_requirement_id::text,true);
  perform set_config('tis.recovery_e2e.prior_booking_id',v_failed_booking_id::text,true);
  perform set_config('tis.recovery_e2e.replacement_booking_id',v_replacement_booking_id::text,true);
end $$;

select
  current_setting('tis.recovery_e2e.requirement_id',true) is not null as fixture_created,
  current_setting('tis.recovery_e2e.prior_booking_id',true)<>current_setting('tis.recovery_e2e.replacement_booking_id',true) as replacement_is_new_booking,
  (select j.sequence_no from public.marketplace_requirement_jobs j
    where j.booking_id=current_setting('tis.recovery_e2e.replacement_booking_id',true)::uuid)=1 as same_sequence_preserved,
  (select r.status='completed' from public.requirement_occurrence_recoveries r
    where r.replacement_booking_id=current_setting('tis.recovery_e2e.replacement_booking_id',true)::uuid) as recovery_audit_completed,
  (select b.payment_status='unpaid' from public.bookings b
    where b.id=current_setting('tis.recovery_e2e.replacement_booking_id',true)::uuid) as replacement_payment_untouched;

rollback;
