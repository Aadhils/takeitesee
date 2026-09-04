-- Provider/customer final recurring lifecycle cross-check.
-- NON-PRODUCTION ONLY. Run against the Takeitesee test Supabase project.
-- Synthetic fixtures are created inside a transaction and rolled back.
-- No finance RPCs are called; synthetic bookings remain unpaid.

begin;

do $$
declare
  v_service public.services%rowtype;
  v_provider_user uuid;
  v_customer_user uuid;
  v_outsider_user uuid;
  v_category_id uuid;
  v_location_id uuid;
  v_day date:=current_date+7;
  v_time time without time zone:=time '10:00';
  v_requirement_id uuid:=gen_random_uuid();
  v_proposal_id uuid:=gen_random_uuid();
  v_booking_one uuid:=gen_random_uuid();
  v_prior_booking uuid:=gen_random_uuid();
  v_booking_two uuid:=gen_random_uuid();
  v_job_one uuid:=gen_random_uuid();
  v_job_two uuid:=gen_random_uuid();
  v_prior_job uuid:=gen_random_uuid();
  v_recovery_id uuid:=gen_random_uuid();
  v_tag text:=replace(gen_random_uuid()::text,'-','');
  v_plan jsonb;
  v_history jsonb;
  v_context_one jsonb;
  v_context_two jsonb;
  v_outsider_blocked boolean:=false;
begin
  select s.* into v_service
  from public.services s
  where s.active=true and s.status='active'
    and (
      (s.provider_type::text='business' and exists(select 1 from public.businesses b where b.id=s.business_id and b.owner_user_id is not null))
      or
      (s.provider_type::text='professional' and exists(select 1 from public.professional_profiles p where p.id=s.professional_id and p.user_id is not null))
    )
  order by s.created_at,s.id
  limit 1;
  if not found then raise exception 'Provider final-state E2E requires an active service.'; end if;

  if v_service.provider_type::text='business' then
    select owner_user_id into v_provider_user from public.businesses where id=v_service.business_id;
  else
    select user_id into v_provider_user from public.professional_profiles where id=v_service.professional_id;
  end if;

  select u.id into v_customer_user from public.users u where u.id<>v_provider_user order by u.id limit 1;
  select u.id into v_outsider_user from public.users u where u.id<>v_provider_user and u.id<>v_customer_user order by u.id limit 1;
  select id into v_category_id from public.platform_categories where active=true order by created_at,id limit 1;
  select id into v_location_id from public.platform_locations where active=true order by created_at,id limit 1;
  if v_customer_user is null or v_outsider_user is null or v_category_id is null or v_location_id is null then
    raise exception 'Provider final-state E2E prerequisites unavailable.';
  end if;

  insert into public.customer_requirements(
    id,requirement_reference,idempotency_key,customer_id,category_id,location_id,title,description,
    service_mode,budget_type,currency,needed_by,status,preferred_start_time,expected_duration_minutes,
    schedule_pattern,recurrence_frequency,recurrence_interval,recurrence_count,recurrence_weekdays
  ) values (
    v_requirement_id,
    'TIS-E2E-PFINAL-'||upper(substr(v_tag,1,8)),
    'provider-final-e2e-'||v_tag,
    v_customer_user,v_category_id,v_location_id,
    'Provider final recurring lifecycle E2E',
    'Rolled-back customer/provider final-state cross-check.',
    'onsite','negotiable',v_service.currency,v_day,'open',v_time,v_service.duration_minutes,
    'recurring','weekly',1,2,array[extract(dow from v_day)::smallint]
  );

  insert into public.requirement_proposals(
    id,proposal_reference,requirement_id,provider_user_id,service_id,amount_minor,currency,message,
    estimated_start_date,status,decided_at,pricing_basis
  ) values (
    v_proposal_id,
    'TIS-E2E-PFP-'||upper(substr(v_tag,1,8)),
    v_requirement_id,v_provider_user,v_service.id,10000,v_service.currency,
    'Synthetic accepted proposal for provider final-state E2E.',
    v_day,'accepted',now(),'per_occurrence'
  );

  update public.customer_requirements
  set status='fulfilled',accepted_proposal_id=v_proposal_id,awarded_at=now()-interval '1 hour',closed_at=now(),updated_at=now()
  where id=v_requirement_id;

  insert into public.bookings(
    id,booking_reference,idempotency_key,customer_id,service_id,provider_type,professional_id,business_id,
    service_name_snapshot,booking_date,start_time,timezone,duration_minutes,location,customer_notes,
    quoted_price,currency,status,payment_status,payment_method
  ) values
  (
    v_booking_one,
    'TIS-E2E-PF1-'||upper(substr(v_tag,1,8)),
    'requirement-job:'||v_requirement_id::text||':1',
    v_customer_user,v_service.id,v_service.provider_type,v_service.professional_id,v_service.business_id,
    v_service.name,v_day,v_time,'Asia/Kolkata',v_service.duration_minutes,
    coalesce(nullif(v_service.location,''),'E2E verification'),'Normal fulfilled occurrence.',100,v_service.currency,
    'completed','unpaid','unselected'
  ),
  (
    v_prior_booking,
    'TIS-E2E-PFPREV-'||upper(substr(v_tag,1,8)),
    'provider-final-prior:'||v_tag,
    v_customer_user,v_service.id,v_service.provider_type,v_service.professional_id,v_service.business_id,
    v_service.name,v_day+7,v_time,'Asia/Kolkata',v_service.duration_minutes,
    coalesce(nullif(v_service.location,''),'E2E verification'),'Prior cancelled occurrence.',100,v_service.currency,
    'cancelled','unpaid','unselected'
  ),
  (
    v_booking_two,
    'TIS-E2E-PF2-'||upper(substr(v_tag,1,8)),
    'requirement-job:'||v_requirement_id::text||':2',
    v_customer_user,v_service.id,v_service.provider_type,v_service.professional_id,v_service.business_id,
    v_service.name,v_day+7,v_time,'Asia/Kolkata',v_service.duration_minutes,
    coalesce(nullif(v_service.location,''),'E2E verification'),'Recovered fulfilled final occurrence.',100,v_service.currency,
    'completed','unpaid','unselected'
  );

  insert into public.marketplace_requirement_jobs(id,requirement_id,proposal_id,booking_id,sequence_no,state,created_by)
  values
    (v_job_one,v_requirement_id,v_proposal_id,v_booking_one,1,'fulfilled',v_customer_user),
    (v_job_two,v_requirement_id,v_proposal_id,v_booking_two,2,'fulfilled',v_customer_user);

  insert into public.requirement_occurrence_recoveries(
    id,requirement_id,sequence_no,prior_job_id,prior_booking_id,prior_proposal_id,action,status,
    replacement_job_id,replacement_booking_id,created_by,completed_at
  ) values (
    v_recovery_id,v_requirement_id,2,v_prior_job,v_prior_booking,v_proposal_id,'retry_same_occurrence','completed',
    v_job_two,v_booking_two,v_customer_user,now()
  );

  perform set_config('request.jwt.claims',json_build_object('sub',v_customer_user,'role','authenticated')::text,true);
  v_plan:=public.get_customer_requirement_occurrence_plan(v_requirement_id);
  v_history:=public.get_customer_requirement_recovery_history(v_requirement_id);

  if (v_plan->>'occurrence_count')::int<>2 then raise exception 'Customer occurrence count mismatch.'; end if;
  if v_plan#>>'{occurrences,0,job_state}'<>'fulfilled' or v_plan#>>'{occurrences,1,job_state}'<>'fulfilled' then
    raise exception 'Customer final occurrence states are not fulfilled.';
  end if;
  if jsonb_array_length(v_history)<>1 or v_history#>>'{0,status}'<>'completed' or (v_history#>>'{0,sequence_no}')::int<>2 then
    raise exception 'Customer recovery history mismatch.';
  end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_provider_user,'role','authenticated')::text,true);
  v_context_one:=public.provider_get_booking_requirement_context(v_booking_one);
  v_context_two:=public.provider_get_booking_requirement_context(v_booking_two);

  if v_context_one->>'requirement_status'<>'fulfilled' or v_context_one->>'job_state'<>'fulfilled' then
    raise exception 'Provider normal occurrence final-state mismatch.';
  end if;
  if (v_context_one->>'occurrence_number')::int<>1 or v_context_one->'recovery' is distinct from 'null'::jsonb then
    raise exception 'Provider normal occurrence context mismatch.';
  end if;
  if v_context_two->>'requirement_status'<>'fulfilled' or v_context_two->>'job_state'<>'fulfilled' then
    raise exception 'Provider recovered occurrence final-state mismatch.';
  end if;
  if (v_context_two->>'occurrence_number')::int<>2 or coalesce((v_context_two#>>'{recovery,attempt_number}')::int,0)<>1 then
    raise exception 'Provider recovered occurrence audit mismatch.';
  end if;
  if (v_context_two#>>'{recovery,prior_booking_id}')::uuid<>v_prior_booking then
    raise exception 'Provider recovered occurrence prior booking mismatch.';
  end if;

  perform set_config('request.jwt.claims',json_build_object('sub',v_outsider_user,'role','authenticated')::text,true);
  begin
    perform public.provider_get_booking_requirement_context(v_booking_two);
  exception when others then
    if position('Provider booking access is required.' in sqlerrm)>0 then v_outsider_blocked:=true; else raise; end if;
  end;
  if not v_outsider_blocked then raise exception 'Unrelated provider was not blocked.'; end if;

  perform set_config('tis.pfinal.customer_states','fulfilled,fulfilled',true);
  perform set_config('tis.pfinal.recovery_count',jsonb_array_length(v_history)::text,true);
  perform set_config('tis.pfinal.provider_normal',v_context_one->>'job_state',true);
  perform set_config('tis.pfinal.provider_recovered',v_context_two->>'job_state',true);
  perform set_config('tis.pfinal.requirement_status',v_context_two->>'requirement_status',true);
  perform set_config('tis.pfinal.recovery_attempt',v_context_two#>>'{recovery,attempt_number}',true);
  perform set_config('tis.pfinal.outsider_blocked',v_outsider_blocked::text,true);
end $$;

select
  current_setting('tis.pfinal.customer_states',true) as customer_occurrence_states,
  current_setting('tis.pfinal.recovery_count',true)::int as customer_recovery_count,
  current_setting('tis.pfinal.provider_normal',true) as provider_normal_job_state,
  current_setting('tis.pfinal.provider_recovered',true) as provider_recovered_job_state,
  current_setting('tis.pfinal.requirement_status',true) as provider_requirement_status,
  current_setting('tis.pfinal.recovery_attempt',true)::int as provider_recovery_attempt,
  current_setting('tis.pfinal.outsider_blocked',true)::boolean as unrelated_provider_blocked;

rollback;
