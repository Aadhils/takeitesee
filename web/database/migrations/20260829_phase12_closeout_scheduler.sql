-- Phase 12 Module 8: database-native hourly SLA closeout sweep.

-- Completed bookings get the longer closeout window; cancelled bookings get the support window.
create or replace function public.sync_completed_booking_closeout()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare p public.booking_closeout_policies%rowtype;
begin
  if (tg_op='INSERT' or (tg_op='UPDATE' and old.status is distinct from new.status)) and new.status in ('completed','cancelled') then
    select * into p from public.booking_closeout_policies where policy_key='default';
    if new.status='completed' then
      insert into public.booking_closeouts(booking_id,attendance_outcome,state,service_completed_at,close_eligible_at,updated_at)
      values(new.id,'service_completed','awaiting_customer',now(),now()+make_interval(days=>p.auto_close_days),now())
      on conflict(booking_id) do update set
        attendance_outcome=case when booking_closeouts.attendance_outcome='pending' then 'service_completed' else booking_closeouts.attendance_outcome end,
        state=case when booking_closeouts.state='open' then 'awaiting_customer' else booking_closeouts.state end,
        service_completed_at=coalesce(booking_closeouts.service_completed_at,now()),
        close_eligible_at=coalesce(booking_closeouts.close_eligible_at,now()+make_interval(days=>p.auto_close_days)),
        updated_at=now();
    else
      insert into public.booking_closeouts(booking_id,attendance_outcome,state,close_eligible_at,updated_at)
      values(new.id,'pending','open',now()+make_interval(days=>p.support_window_days),now())
      on conflict(booking_id) do update set
        close_eligible_at=coalesce(booking_closeouts.close_eligible_at,now()+make_interval(days=>p.support_window_days)),
        updated_at=now();
    end if;
  end if;
  return new;
end;
$$;

insert into public.booking_closeouts(booking_id,attendance_outcome,state,close_eligible_at,updated_at)
select b.id,'pending','open',b.updated_at+make_interval(days=>p.support_window_days),now()
from public.bookings b cross join public.booking_closeout_policies p
where b.status='cancelled' and p.policy_key='default'
on conflict(booking_id) do nothing;

-- Provider no-show always opens support and gets a support-window close target.
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

  insert into public.booking_closeouts(booking_id,attendance_outcome,state,provider_no_show_reported_at,close_eligible_at,updated_at)
  values(b.id,'provider_no_show','support_open',now(),now()+make_interval(days=>p.support_window_days),now())
  on conflict(booking_id) do update set
    attendance_outcome='provider_no_show',provider_no_show_reported_at=now(),close_eligible_at=now()+make_interval(days=>p.support_window_days),state='support_open',updated_at=now()
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
end;
$$;

create or replace function public.booking_closeout_payment_settled(b public.bookings, c public.booking_closeouts)
returns boolean
language sql
stable
set search_path=public
as $$
  select case
    when b.status='cancelled' or c.attendance_outcome='provider_no_show'
      then b.payment_status in ('unpaid','failed','refunded')
    else b.payment_status in ('paid','refunded')
  end;
$$;

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
  if c.close_eligible_at is not null and now()>=c.close_eligible_at and public.booking_closeout_payment_settled(b,c) then
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
end;
$$;

-- Service-role sweep performs the same closeout rule without a user session.
create or replace function public.sweep_booking_closeouts()
returns integer
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  rec record;
  c public.booking_closeouts%rowtype;
  active_issue boolean;
  provider_user_id uuid;
  changed integer:=0;
begin
  for rec in
    select b.* from public.bookings b join public.booking_closeouts x on x.booking_id=b.id
    where x.closed_at is null and x.close_eligible_at is not null and x.close_eligible_at<=now()
    order by x.close_eligible_at
    limit 1000
  loop
    select * into c from public.booking_closeouts where booking_id=rec.id for update;
    select exists(select 1 from public.marketplace_issues where booking_id=rec.id and status in('open','investigating','awaiting_information')) into active_issue;
    if active_issue then
      update public.booking_closeouts set state='support_open',updated_at=now() where booking_id=rec.id;
      continue;
    end if;

    if public.booking_closeout_payment_settled(rec,c) then
      update public.booking_closeouts set state='closed',closed_at=now(),closed_reason='sla_window_elapsed',updated_at=now() where booking_id=rec.id;
      if not exists(select 1 from public.booking_closeout_events where booking_id=rec.id and event_type='closed') then
        insert into public.booking_closeout_events(booking_id,actor_type,event_type,note) values(rec.id,'system','closed','Hourly SLA sweep closed the lifecycle after all blockers cleared.');
        insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(rec.customer_id,rec.id,'closeout_closed','Booking lifecycle closed','The review and support windows have ended and this booking is finally closed.');
        if rec.provider_type='professional' then select user_id into provider_user_id from public.professional_profiles where id=rec.professional_id; else select owner_user_id into provider_user_id from public.businesses where id=rec.business_id; end if;
        if provider_user_id is not null and provider_user_id is distinct from rec.customer_id then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(provider_user_id,rec.id,'closeout_closed','Booking lifecycle closed','This booking has completed its closeout window and is finally closed.'); end if;
      end if;
      changed:=changed+1;
    else
      update public.booking_closeouts set state='eligible_to_close',updated_at=now() where booking_id=rec.id;
      if not exists(select 1 from public.booking_closeout_events where booking_id=rec.id and event_type='eligible_to_close') then insert into public.booking_closeout_events(booking_id,actor_type,event_type,note) values(rec.id,'system','eligible_to_close','Hourly SLA sweep found payment settlement still outstanding.'); end if;
    end if;
  end loop;
  return changed;
end;
$$;
revoke all on function public.sweep_booking_closeouts() from public, anon, authenticated;
grant execute on function public.sweep_booking_closeouts() to service_role;

create extension if not exists pg_cron;
do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname='takeitesee-booking-closeout-sweep' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('takeitesee-booking-closeout-sweep','17 * * * *','select public.sweep_booking_closeouts();');
end;
$$;
