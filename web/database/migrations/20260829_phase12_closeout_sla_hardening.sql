-- Phase 12 Module 8 hardening: immutable attendance outcome and support-window enforcement.

create or replace function public.provider_report_customer_no_show(target_booking_id uuid, report_note text default null)
returns public.booking_closeouts language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; c public.booking_closeouts%rowtype; p public.booking_closeout_policies%rowtype; owns boolean:=false; n text:=nullif(btrim(coalesce(report_note,'')),''); existing_outcome text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id for update;
  if not found or b.status<>'confirmed' then raise exception 'Only a confirmed booking can be marked customer no-show.'; end if;
  if b.provider_type='professional' then select exists(select 1 from public.professional_profiles x where x.id=b.professional_id and x.user_id=auth.uid()) into owns;
  else select exists(select 1 from public.businesses x where x.id=b.business_id and x.owner_user_id=auth.uid()) into owns; end if;
  if not owns then raise exception 'Booking is not owned by this provider.'; end if;
  select attendance_outcome into existing_outcome from public.booking_closeouts where booking_id=b.id;
  if existing_outcome is not null and existing_outcome<>'pending' then raise exception 'An attendance outcome is already recorded. Use support to dispute it.'; end if;
  select * into p from public.booking_closeout_policies where policy_key='default';
  if now() < public.booking_closeout_scheduled_start(b)+make_interval(mins=>p.no_show_grace_minutes) then raise exception 'The no-show grace period has not ended.'; end if;
  insert into public.booking_closeouts(booking_id,attendance_outcome,state,customer_no_show_reported_at,close_eligible_at,updated_at)
  values(b.id,'customer_no_show','open',now(),now()+make_interval(days=>p.support_window_days),now())
  on conflict(booking_id) do update set attendance_outcome='customer_no_show',customer_no_show_reported_at=now(),close_eligible_at=now()+make_interval(days=>p.support_window_days),state='open',updated_at=now()
  returning * into c;
  insert into public.booking_closeout_events(booking_id,actor_user_id,actor_type,event_type,note) values(b.id,auth.uid(),'provider','customer_no_show_reported',n);
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(b.customer_id,b.id,'customer_no_show','Attendance marked as no-show','The provider reported that you did not attend this booking. You can open support during the dispute window if you disagree.');
  return c;
end; $$;

create or replace function public.customer_report_provider_no_show(target_booking_id uuid, report_note text default null)
returns public.booking_closeouts language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; c public.booking_closeouts%rowtype; p public.booking_closeout_policies%rowtype; n text:=nullif(btrim(coalesce(report_note,'')),''); provider_user_id uuid; issue_row public.marketplace_issues%rowtype; existing_outcome text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id and customer_id=auth.uid() for update;
  if not found or b.status<>'confirmed' then raise exception 'Only your confirmed booking can report a provider no-show.'; end if;
  select attendance_outcome into existing_outcome from public.booking_closeouts where booking_id=b.id;
  if existing_outcome is not null and existing_outcome<>'pending' then raise exception 'An attendance outcome is already recorded. Use support to dispute it.'; end if;
  select * into p from public.booking_closeout_policies where policy_key='default';
  if now() < public.booking_closeout_scheduled_start(b)+make_interval(mins=>p.no_show_grace_minutes) then raise exception 'The no-show grace period has not ended.'; end if;
  insert into public.booking_closeouts(booking_id,attendance_outcome,state,provider_no_show_reported_at,updated_at)
  values(b.id,'provider_no_show','support_open',now(),now())
  on conflict(booking_id) do update set attendance_outcome='provider_no_show',provider_no_show_reported_at=now(),state='support_open',updated_at=now()
  returning * into c;
  insert into public.booking_closeout_events(booking_id,actor_user_id,actor_type,event_type,note) values(b.id,auth.uid(),'customer','provider_no_show_reported',n);
  if not exists(select 1 from public.marketplace_issues where booking_id=b.id and status in('open','investigating','awaiting_information')) then
    insert into public.marketplace_issues(booking_id,service_id,reported_by,category,summary,details,priority,status)
    values(b.id,b.service_id,auth.uid(),'Provider no-show','Provider did not attend the scheduled booking.',n,'high','open') returning * into issue_row;
    insert into public.marketplace_issue_events(issue_id,booking_id,actor_user_id,actor_type,event_type,to_status,note) values(issue_row.id,b.id,auth.uid(),'customer','opened','open','Provider no-show reported.');
  end if;
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(auth.uid(),b.id,'support_opened','Provider no-show case opened','Your provider no-show report has been placed in the support queue.');
  if b.provider_type='professional' then select user_id into provider_user_id from public.professional_profiles where id=b.professional_id; else select owner_user_id into provider_user_id from public.businesses where id=b.business_id; end if;
  if provider_user_id is not null then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(provider_user_id,b.id,'provider_no_show','Provider no-show reported','The customer reported that the provider did not attend. A support case is open.'); end if;
  return c;
end; $$;

create or replace function public.open_booking_support_case(
  target_booking_id uuid,
  issue_category text,
  issue_summary text,
  issue_details text default null,
  issue_priority text default 'medium'
)
returns public.marketplace_issues
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype; issue_row public.marketplace_issues%rowtype; closeout_row public.booking_closeouts%rowtype; policy_row public.booking_closeout_policies%rowtype;
  category_value text:=btrim(coalesce(issue_category,'')); summary_value text:=btrim(coalesce(issue_summary,'')); details_value text:=nullif(btrim(coalesce(issue_details,'')),''); provider_user_id uuid; terminal_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(category_value)<2 or char_length(category_value)>80 then raise exception 'Choose a valid support category.'; end if;
  if char_length(summary_value)<3 or char_length(summary_value)>180 then raise exception 'Support summary must be 3 to 180 characters.'; end if;
  if details_value is not null and char_length(details_value)>2000 then raise exception 'Support details must be 2000 characters or fewer.'; end if;
  if issue_priority not in('low','medium','high','urgent') then raise exception 'Support priority is invalid.'; end if;
  select * into booking_row from public.bookings where id=target_booking_id and customer_id=auth.uid();
  if not found then raise exception 'Booking not found.'; end if;
  select * into policy_row from public.booking_closeout_policies where policy_key='default';
  select * into closeout_row from public.booking_closeouts where booking_id=booking_row.id;
  if closeout_row.closed_at is not null then raise exception 'This booking is already finally closed.'; end if;
  if booking_row.status in('completed','cancelled') or closeout_row.attendance_outcome='customer_no_show' then
    terminal_at:=coalesce(closeout_row.customer_no_show_reported_at,closeout_row.service_completed_at,booking_row.updated_at);
    if terminal_at is not null and now()>terminal_at+make_interval(days=>policy_row.support_window_days) then raise exception 'The support window for this booking has ended.'; end if;
  end if;
  if exists(select 1 from public.marketplace_issues where booking_id=target_booking_id and status in('open','investigating','awaiting_information')) then raise exception 'An active support case already exists for this booking.'; end if;
  insert into public.marketplace_issues(booking_id,service_id,reported_by,category,summary,details,priority,status)
  values(booking_row.id,booking_row.service_id,auth.uid(),category_value,summary_value,details_value,issue_priority,'open') returning * into issue_row;
  insert into public.marketplace_issue_events(issue_id,booking_id,actor_user_id,actor_type,event_type,to_status,note) values(issue_row.id,booking_row.id,auth.uid(),'customer','opened','open',summary_value);
  update public.booking_closeouts set state='support_open',updated_at=now() where booking_id=booking_row.id;
  if booking_row.provider_type='professional' then select user_id into provider_user_id from public.professional_profiles where id=booking_row.professional_id; else select owner_user_id into provider_user_id from public.businesses where id=booking_row.business_id; end if;
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(auth.uid(),booking_row.id,'support_opened','Support case opened','Your support request has been recorded and is now in the operations queue.');
  if provider_user_id is not null then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(provider_user_id,booking_row.id,'support_opened','Support case opened','A customer opened a support case linked to this booking.'); end if;
  return issue_row;
end; $$;

create or replace function public.apply_booking_closeout_rules(target_booking_id uuid)
returns public.booking_closeouts language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; c public.booking_closeouts%rowtype; active_issue boolean; can_view boolean:=false; provider_user_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id;
  if not found then raise exception 'Booking not found.'; end if;
  can_view:=b.customer_id=auth.uid() or exists(select 1 from public.professional_profiles p where p.id=b.professional_id and p.user_id=auth.uid()) or exists(select 1 from public.businesses x where x.id=b.business_id and x.owner_user_id=auth.uid()) or exists(select 1 from public.service_ecosystem_scope ses where ses.service_id=b.service_id and ses.enabled=true and public.admin_can_view(ses.application_id,ses.location_id,ses.category_id,ses.service_id));
  if not can_view then raise exception 'Booking is not accessible.'; end if;
  select * into c from public.booking_closeouts where booking_id=b.id for update;
  if not found then return null; end if;
  select exists(select 1 from public.marketplace_issues where booking_id=b.id and status in('open','investigating','awaiting_information')) into active_issue;
  if c.closed_at is not null then return c; end if;
  if active_issue then update public.booking_closeouts set state='support_open',updated_at=now() where booking_id=b.id returning * into c; return c; end if;
  if c.close_eligible_at is not null and now()>=c.close_eligible_at and b.payment_status in('paid','refunded') then
    update public.booking_closeouts set state='closed',closed_at=now(),closed_reason='sla_window_elapsed',updated_at=now() where booking_id=b.id returning * into c;
    if not exists(select 1 from public.booking_closeout_events where booking_id=b.id and event_type='closed') then
      insert into public.booking_closeout_events(booking_id,actor_type,event_type,note) values(b.id,'system','closed','SLA windows elapsed with no active support case and payment settled.');
      insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(b.customer_id,b.id,'closeout_closed','Booking lifecycle closed','The review and support windows have ended and this booking is finally closed.');
      if b.provider_type='professional' then select user_id into provider_user_id from public.professional_profiles where id=b.professional_id; else select owner_user_id into provider_user_id from public.businesses where id=b.business_id; end if;
      if provider_user_id is not null and provider_user_id is distinct from b.customer_id then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(provider_user_id,b.id,'closeout_closed','Booking lifecycle closed','This booking has completed its closeout window and is finally closed.'); end if;
    end if;
    return c;
  end if;
  if c.close_eligible_at is not null and now()>=c.close_eligible_at then
    update public.booking_closeouts set state='eligible_to_close',updated_at=now() where booking_id=b.id returning * into c;
    if not exists(select 1 from public.booking_closeout_events where booking_id=b.id and event_type='eligible_to_close') then insert into public.booking_closeout_events(booking_id,actor_type,event_type,note) values(b.id,'system','eligible_to_close','SLA window ended; final closure is waiting for payment settlement.'); end if;
  end if;
  return c;
end; $$;
