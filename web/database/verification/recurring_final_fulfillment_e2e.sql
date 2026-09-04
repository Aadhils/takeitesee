-- Final recurring occurrence fulfillment / closure E2E verification.
-- NON-PRODUCTION ONLY. Run against the Takeitesee test Supabase project.
-- The script creates all requirement/booking fixtures inside one transaction and rolls them back.
-- Finance/payment notification/reconciliation triggers are temporarily disabled only around the
-- synthetic settled-completion transitions so this verifies the non-finance lifecycle path
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
  v_day date;
  v_time time without time zone;
  v_requirement_id uuid:=gen_random_uuid();
  v_proposal_id uuid:=gen_random_uuid();
  v_original_booking_id uuid:=gen_random_uuid();
  v_original_job_id uuid:=gen_random_uuid();
  v_tag text:=replace(gen_random_uuid()::text,'-','');
  v_recovery jsonb;
  v_seq2 jsonb;
  v_seq3 jsonb;
  v_b1 uuid;
  v_b2 uuid;
  v_b3 uuid;
  v_j1 uuid;
  v_j2 uuid;
  v_j3 uuid;
  v_ctx3 jsonb;
  v_recovery_count integer;
  v_fulfilled_count integer;
  v_seq4_blocked boolean:=false;
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
  if not found then raise exception 'Final closure E2E requires one active provider service.'; end if;

  if v_service.provider_type::text='business' then
    select owner_user_id into v_provider_user from public.businesses where id=v_service.business_id;
  else
    select user_id into v_provider_user from public.professional_profiles where id=v_service.professional_id;
  end if;

  select u.id into v_customer_user from public.users u where u.id<>v_provider_user order by u.id limit 1;
  select id into v_category_id from public.platform_categories where active=true order by created_at,id limit 1;
  select id into v_location_id from public.platform_locations where active=true order by created_at,id limit 1;
  if v_customer_user is null or v_category_id is null or v_location_id is null then
    raise exception 'Final closure E2E fixture prerequisites unavailable.';
  end if;

  select coalesce(nullif(sa.timezone,''),'Asia/Kolkata') into v_timezone
  from (select 1) q
  left join public.service_availability sa on sa.service_id=v_service.id;

  select gs::date,w.start_time into v_day,v_time
  from generate_series(current_date+7,current_date+70,interval '1 day') gs
  join public.service_availability_windows w
    on w.service_id=v_service.id
   and w.day_of_week=extract(dow from gs)::smallint
  where (gs::date::timestamp+w.end_time)>=(gs::date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes))
    and exists(
      select 1 from public.service_availability_windows w2
      where w2.service_id=v_service.id
        and w2.day_of_week=extract(dow from (gs::date+7))::smallint
        and w2.start_time<=w.start_time
        and w2.end_time>=w.start_time+make_interval(mins=>v_service.duration_minutes)
    )
    and exists(
      select 1 from public.service_availability_windows w3
      where w3.service_id=v_service.id
        and w3.day_of_week=extract(dow from (gs::date+14))::smallint
        and w3.start_time<=w.start_time
        and w3.end_time>=w.start_time+make_interval(mins=>v_service.duration_minutes)
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
        and x.starts_at<(((gs::date+7)::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes)) at time zone v_timezone)
        and x.ends_at>(((gs::date+7)::timestamp+w.start_time) at time zone v_timezone)
    )
    and not exists(
      select 1 from public.service_availability_blackouts x
      where x.service_id=v_service.id
        and x.starts_at<(((gs::date+14)::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes)) at time zone v_timezone)
        and x.ends_at>(((gs::date+14)::timestamp+w.start_time) at time zone v_timezone)
    )
    and not exists(
      select 1 from public.bookings b
      where b.booking_date in (gs::date,gs::date+7,gs::date+14)
        and b.status in ('pending','confirmed','rescheduled')
        and (
          (v_service.provider_type::text='business' and b.business_id=v_service.business_id)
          or
          (v_service.provider_type::text='professional' and b.professional_id=v_service.professional_id)
        )
        and (b.booking_date::timestamp+b.start_time)<(b.booking_date::timestamp+w.start_time+make_interval(mins=>v_service.duration_minutes))
        and (b.booking_date::timestamp+b.start_time+make_interval(mins=>b.duration_minutes))>(b.booking_date::timestamp+w.start_time)
    )
  order by gs,w.start_time
  limit 1;
  if v_day is null then raise exception 'Final closure E2E could not find three weekly slots.'; end if;

  insert into public.customer_requirements(
    id,requirement_reference,idempotency_key,customer_id,category_id,location_id,title,description,
    service_mode,budget_type,currency,needed_by,status,preferred_start_time,expected_duration_minutes,
    schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,recurrence_weekdays
  ) values (
    v_requirement_id,
    'TIS-E2E-FIN-'||upper(substr(v_tag,1,10)),
    'final-closure-e2e-'||v_tag,
    v_customer_user,v_category_id,v_location_id,
    'Recurring final closure E2E',
    'Rolled-back final recurring occurrence fulfillment verification.',
    'onsite','negotiable',v_service.currency,v_day,'open',v_time,v_service.duration_minutes,
    'recurring','weekly',1,3,array[extract(dow from v_day)::smallint]
  );

  insert into public.requirement_proposals(
    id,proposal_reference,requirement_id,provider_user_id,service_id,amount_minor,currency,message,
    estimated_start_date,status,decided_at,pricing_basis
  ) values (
    v_proposal_id,
    'TIS-E2E-FP-'||upper(substr(v_tag,1,10)),
    v_requirement_id,v_provider_user,v_service.id,12000,v_service.currency,
    'Synthetic accepted proposal for final closure E2E.',
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
    'TIS-E2E-FB-'||upper(substr(v_tag,1,10)),
    'requirement-job:'||v_requirement_id::text||':1',
    v_customer_user,v_service.id,v_service.provider_type,v_service.professional_id,v_service.business_id,
    v_service.name,v_day,v_time,v_timezone,v_service.duration_minutes,
    coalesce(nullif(v_service.location,''),'E2E verification'),
    'Synthetic original cancelled occurrence.',120,v_service.currency,'cancelled','unpaid','unselected'
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
    v_requirement_id,v_day,v_time,'Recover sequence one before final closure E2E'
  );
  v_b1:=nullif(v_recovery#>>'{booking,id}','')::uuid;
  v_j1:=nullif(v_recovery#>>'{job,id}','')::uuid;
  if v_b1 is null or (v_recovery#>>'{job,sequence_no}')::int<>1 then
    raise exception 'Sequence #1 recovery failed.';
  end if;

  alter table public.bookings disable trigger bookings_reconcile_finance_settlement;
  alter table public.bookings disable trigger bookings_emit_payment_notifications;
  alter table public.bookings disable trigger bookings_log_payment_event_update;
  update public.bookings set status='completed',payment_status='paid',updated_at=now() where id=v_b1;
  alter table public.bookings enable trigger bookings_log_payment_event_update;
  alter table public.bookings enable trigger bookings_emit_payment_notifications;
  alter table public.bookings enable trigger bookings_reconcile_finance_settlement;
  perform public.customer_confirm_service_completion(v_b1);
  if not exists(select 1 from public.marketplace_requirement_jobs where id=v_j1 and state='fulfilled') then
    raise exception 'Sequence #1 not fulfilled.';
  end if;

  v_seq2:=public.customer_create_requirement_job(v_requirement_id,v_day+7,v_time,'Sequence two');
  v_b2:=nullif(v_seq2#>>'{booking,id}','')::uuid;
  v_j2:=nullif(v_seq2#>>'{job,id}','')::uuid;
  if (v_seq2#>>'{job,sequence_no}')::int<>2 then raise exception 'Sequence #2 creation failed.'; end if;

  alter table public.bookings disable trigger bookings_reconcile_finance_settlement;
  alter table public.bookings disable trigger bookings_emit_payment_notifications;
  alter table public.bookings disable trigger bookings_log_payment_event_update;
  update public.bookings set status='completed',payment_status='paid',updated_at=now() where id=v_b2;
  alter table public.bookings enable trigger bookings_log_payment_event_update;
  alter table public.bookings enable trigger bookings_emit_payment_notifications;
  alter table public.bookings enable trigger bookings_reconcile_finance_settlement;
  perform public.customer_confirm_service_completion(v_b2);
  if not exists(select 1 from public.marketplace_requirement_jobs where id=v_j2 and state='fulfilled') then
    raise exception 'Sequence #2 not fulfilled.';
  end if;
  if not exists(
    select 1 from public.customer_requirements
    where id=v_requirement_id and status='awarded' and closed_at is null
  ) then
    raise exception 'Requirement closed before final occurrence.';
  end if;

  v_seq3:=public.customer_create_requirement_job(v_requirement_id,v_day+14,v_time,'Final sequence three');
  v_b3:=nullif(v_seq3#>>'{booking,id}','')::uuid;
  v_j3:=nullif(v_seq3#>>'{job,id}','')::uuid;
  if (v_seq3#>>'{job,sequence_no}')::int<>3 then raise exception 'Final sequence #3 creation failed.'; end if;

  alter table public.bookings disable trigger bookings_reconcile_finance_settlement;
  alter table public.bookings disable trigger bookings_emit_payment_notifications;
  alter table public.bookings disable trigger bookings_log_payment_event_update;
  update public.bookings set status='completed',payment_status='paid',updated_at=now() where id=v_b3;
  alter table public.bookings enable trigger bookings_log_payment_event_update;
  alter table public.bookings enable trigger bookings_emit_payment_notifications;
  alter table public.bookings enable trigger bookings_reconcile_finance_settlement;
  perform public.customer_confirm_service_completion(v_b3);

  select count(*) into v_fulfilled_count
  from public.marketplace_requirement_jobs
  where requirement_id=v_requirement_id and state='fulfilled';
  if v_fulfilled_count<>3 then raise exception 'Fulfilled occurrence count mismatch: %',v_fulfilled_count; end if;

  if not exists(
    select 1 from public.customer_requirements
    where id=v_requirement_id and status='fulfilled' and closed_at is not null
  ) then
    raise exception 'Requirement did not close after final occurrence.';
  end if;

  select count(*) into v_recovery_count
  from public.requirement_occurrence_recoveries
  where requirement_id=v_requirement_id and status='completed';
  if v_recovery_count<>1 then raise exception 'Recovery audit changed during final closure.'; end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',v_provider_user,'role','authenticated')::text,
    true
  );
  v_ctx3:=public.provider_get_booking_requirement_context(v_b3);
  if (v_ctx3->>'occurrence_number')::int<>3 then raise exception 'Final provider occurrence context mismatch.'; end if;
  if v_ctx3->'recovery' is distinct from 'null'::jsonb then
    raise exception 'Final normal occurrence incorrectly carries recovery context.';
  end if;

  perform set_config(
    'request.jwt.claims',
    json_build_object('sub',v_customer_user,'role','authenticated')::text,
    true
  );
  begin
    perform public.customer_create_requirement_job(v_requirement_id,v_day+21,v_time,'Sequence four must be blocked');
  exception when others then
    v_seq4_blocked:=true;
  end;
  if not v_seq4_blocked then raise exception 'Sequence #4 was not blocked after requirement closure.'; end if;
  if exists(
    select 1 from public.marketplace_requirement_jobs
    where requirement_id=v_requirement_id and sequence_no=4
  ) then
    raise exception 'Sequence #4 row exists after closure.';
  end if;

  perform set_config('tis.final_e2e.fulfilled_count',v_fulfilled_count::text,true);
  perform set_config('tis.final_e2e.requirement_fulfilled','true',true);
  perform set_config('tis.final_e2e.closed_at_set','true',true);
  perform set_config('tis.final_e2e.seq4_blocked',v_seq4_blocked::text,true);
  perform set_config('tis.final_e2e.recovery_count',v_recovery_count::text,true);
  perform set_config(
    'tis.final_e2e.final_recovery_null',
    (v_ctx3->'recovery' is null or v_ctx3->'recovery'='null'::jsonb)::text,
    true
  );
end $$;

select
  current_setting('tis.final_e2e.fulfilled_count',true)::int as fulfilled_occurrences,
  current_setting('tis.final_e2e.requirement_fulfilled',true)::boolean as requirement_fulfilled,
  current_setting('tis.final_e2e.closed_at_set',true)::boolean as closed_at_set,
  current_setting('tis.final_e2e.seq4_blocked',true)::boolean as sequence_four_blocked,
  current_setting('tis.final_e2e.recovery_count',true)::int as recovery_audit_count,
  current_setting('tis.final_e2e.final_recovery_null',true)::boolean as final_occurrence_has_no_recovery_marker;

rollback;
