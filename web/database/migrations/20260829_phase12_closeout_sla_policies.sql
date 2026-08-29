-- Phase 12 Module 8: attendance outcomes, SLA windows, and final closeout.

create table if not exists public.booking_closeout_policies (
  policy_key text primary key,
  no_show_grace_minutes integer not null check (no_show_grace_minutes between 5 and 240),
  completion_confirmation_hours integer not null check (completion_confirmation_hours between 1 and 168),
  review_window_days integer not null check (review_window_days between 1 and 90),
  support_window_days integer not null check (support_window_days between 1 and 90),
  auto_close_days integer not null check (auto_close_days between 1 and 180),
  updated_at timestamptz not null default now()
);

insert into public.booking_closeout_policies(policy_key,no_show_grace_minutes,completion_confirmation_hours,review_window_days,support_window_days,auto_close_days)
values ('default',30,24,14,7,14)
on conflict (policy_key) do nothing;

create table if not exists public.booking_closeouts (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  attendance_outcome text not null default 'pending' check (attendance_outcome in ('pending','service_completed','customer_no_show','provider_no_show')),
  state text not null default 'open' check (state in ('open','awaiting_customer','support_open','eligible_to_close','closed')),
  service_completed_at timestamptz,
  customer_completion_confirmed_at timestamptz,
  customer_no_show_reported_at timestamptz,
  provider_no_show_reported_at timestamptz,
  close_eligible_at timestamptz,
  closed_at timestamptz,
  closed_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_closeout_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('customer','provider','admin','system')),
  event_type text not null check (event_type in ('customer_completion_confirmed','customer_no_show_reported','provider_no_show_reported','eligible_to_close','closed')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists booking_closeout_events_booking_created_idx on public.booking_closeout_events(booking_id,created_at);

alter table public.booking_closeout_policies enable row level security;
alter table public.booking_closeouts enable row level security;
alter table public.booking_closeout_events enable row level security;

drop policy if exists closeout_policy_authenticated_read on public.booking_closeout_policies;
create policy closeout_policy_authenticated_read on public.booking_closeout_policies for select to authenticated using (true);

drop policy if exists booking_closeouts_customer_read on public.booking_closeouts;
create policy booking_closeouts_customer_read on public.booking_closeouts for select to authenticated using (
  exists(select 1 from public.bookings b where b.id=booking_closeouts.booking_id and b.customer_id=auth.uid())
);
drop policy if exists booking_closeouts_provider_read on public.booking_closeouts;
create policy booking_closeouts_provider_read on public.booking_closeouts for select to authenticated using (
  exists(select 1 from public.bookings b where b.id=booking_closeouts.booking_id and (
    exists(select 1 from public.professional_profiles p where p.id=b.professional_id and p.user_id=auth.uid()) or
    exists(select 1 from public.businesses biz where biz.id=b.business_id and biz.owner_user_id=auth.uid())
  ))
);
drop policy if exists booking_closeouts_admin_read on public.booking_closeouts;
create policy booking_closeouts_admin_read on public.booking_closeouts for select to authenticated using (
  exists(select 1 from public.bookings b join public.service_ecosystem_scope ses on ses.service_id=b.service_id and ses.enabled=true where b.id=booking_closeouts.booking_id and public.admin_can_view(ses.application_id,ses.location_id,ses.category_id,ses.service_id))
);

drop policy if exists booking_closeout_events_customer_read on public.booking_closeout_events;
create policy booking_closeout_events_customer_read on public.booking_closeout_events for select to authenticated using (
  exists(select 1 from public.bookings b where b.id=booking_closeout_events.booking_id and b.customer_id=auth.uid())
);
drop policy if exists booking_closeout_events_provider_read on public.booking_closeout_events;
create policy booking_closeout_events_provider_read on public.booking_closeout_events for select to authenticated using (
  exists(select 1 from public.bookings b where b.id=booking_closeout_events.booking_id and (
    exists(select 1 from public.professional_profiles p where p.id=b.professional_id and p.user_id=auth.uid()) or
    exists(select 1 from public.businesses biz where biz.id=b.business_id and biz.owner_user_id=auth.uid())
  ))
);
drop policy if exists booking_closeout_events_admin_read on public.booking_closeout_events;
create policy booking_closeout_events_admin_read on public.booking_closeout_events for select to authenticated using (
  exists(select 1 from public.bookings b join public.service_ecosystem_scope ses on ses.service_id=b.service_id and ses.enabled=true where b.id=booking_closeout_events.booking_id and public.admin_can_view(ses.application_id,ses.location_id,ses.category_id,ses.service_id))
);

create or replace function public.booking_closeout_scheduled_start(b public.bookings)
returns timestamptz language sql stable set search_path=public as $$
  select ((b.booking_date + b.start_time) at time zone coalesce(nullif(b.timezone,''),'Asia/Kolkata'));
$$;

create or replace function public.sync_completed_booking_closeout()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare p public.booking_closeout_policies%rowtype;
begin
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from new.status) then
    select * into p from public.booking_closeout_policies where policy_key='default';
    insert into public.booking_closeouts(booking_id,attendance_outcome,state,service_completed_at,close_eligible_at,updated_at)
    values(new.id,'service_completed','awaiting_customer',now(),now()+make_interval(days=>p.auto_close_days),now())
    on conflict(booking_id) do update set
      attendance_outcome=case when booking_closeouts.attendance_outcome='pending' then 'service_completed' else booking_closeouts.attendance_outcome end,
      state=case when booking_closeouts.state='open' then 'awaiting_customer' else booking_closeouts.state end,
      service_completed_at=coalesce(booking_closeouts.service_completed_at,now()),
      close_eligible_at=coalesce(booking_closeouts.close_eligible_at,now()+make_interval(days=>p.auto_close_days)),
      updated_at=now();
  end if;
  return new;
end; $$;
drop trigger if exists bookings_sync_closeout on public.bookings;
create trigger bookings_sync_closeout after insert or update of status on public.bookings for each row execute function public.sync_completed_booking_closeout();

insert into public.booking_closeouts(booking_id,attendance_outcome,state,service_completed_at,close_eligible_at,updated_at)
select b.id,'service_completed','awaiting_customer',b.updated_at,b.updated_at+make_interval(days=>p.auto_close_days),now()
from public.bookings b cross join public.booking_closeout_policies p
where b.status='completed' and p.policy_key='default'
on conflict(booking_id) do nothing;

create or replace function public.customer_confirm_service_completion(target_booking_id uuid)
returns public.booking_closeouts language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; c public.booking_closeouts%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id and customer_id=auth.uid();
  if not found or b.status<>'completed' then raise exception 'Only your completed booking can be confirmed.'; end if;
  insert into public.booking_closeouts(booking_id,attendance_outcome,state,service_completed_at,customer_completion_confirmed_at,updated_at)
  values(b.id,'service_completed','open',coalesce(b.updated_at,now()),now(),now())
  on conflict(booking_id) do update set customer_completion_confirmed_at=coalesce(booking_closeouts.customer_completion_confirmed_at,now()), state=case when booking_closeouts.state='awaiting_customer' then 'open' else booking_closeouts.state end, updated_at=now()
  returning * into c;
  if not exists(select 1 from public.booking_closeout_events where booking_id=b.id and event_type='customer_completion_confirmed') then
    insert into public.booking_closeout_events(booking_id,actor_user_id,actor_type,event_type,note) values(b.id,auth.uid(),'customer','customer_completion_confirmed','Customer acknowledged service completion.');
  end if;
  return c;
end; $$;

create or replace function public.provider_report_customer_no_show(target_booking_id uuid, report_note text default null)
returns public.booking_closeouts language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; c public.booking_closeouts%rowtype; p public.booking_closeout_policies%rowtype; owns boolean:=false; n text:=nullif(btrim(coalesce(report_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id for update;
  if not found or b.status<>'confirmed' then raise exception 'Only a confirmed booking can be marked customer no-show.'; end if;
  if b.provider_type='professional' then select exists(select 1 from public.professional_profiles x where x.id=b.professional_id and x.user_id=auth.uid()) into owns;
  else select exists(select 1 from public.businesses x where x.id=b.business_id and x.owner_user_id=auth.uid()) into owns; end if;
  if not owns then raise exception 'Booking is not owned by this provider.'; end if;
  select * into p from public.booking_closeout_policies where policy_key='default';
  if now() < public.booking_closeout_scheduled_start(b)+make_interval(mins=>p.no_show_grace_minutes) then raise exception 'The no-show grace period has not ended.'; end if;
  insert into public.booking_closeouts(booking_id,attendance_outcome,state,customer_no_show_reported_at,close_eligible_at,updated_at)
  values(b.id,'customer_no_show','open',now(),now()+make_interval(days=>p.support_window_days),now())
  on conflict(booking_id) do update set attendance_outcome='customer_no_show',customer_no_show_reported_at=coalesce(booking_closeouts.customer_no_show_reported_at,now()),close_eligible_at=coalesce(booking_closeouts.close_eligible_at,now()+make_interval(days=>p.support_window_days)),state='open',updated_at=now()
  returning * into c;
  insert into public.booking_closeout_events(booking_id,actor_user_id,actor_type,event_type,note) values(b.id,auth.uid(),'provider','customer_no_show_reported',n);
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(b.customer_id,b.id,'customer_no_show','Attendance marked as no-show','The provider reported that you did not attend this booking. You can open support if you disagree.');
  return c;
end; $$;

create or replace function public.customer_report_provider_no_show(target_booking_id uuid, report_note text default null)
returns public.booking_closeouts language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; c public.booking_closeouts%rowtype; p public.booking_closeout_policies%rowtype; n text:=nullif(btrim(coalesce(report_note,'')),''); provider_user_id uuid; issue_row public.marketplace_issues%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id and customer_id=auth.uid() for update;
  if not found or b.status<>'confirmed' then raise exception 'Only your confirmed booking can report a provider no-show.'; end if;
  select * into p from public.booking_closeout_policies where policy_key='default';
  if now() < public.booking_closeout_scheduled_start(b)+make_interval(mins=>p.no_show_grace_minutes) then raise exception 'The no-show grace period has not ended.'; end if;
  insert into public.booking_closeouts(booking_id,attendance_outcome,state,provider_no_show_reported_at,updated_at)
  values(b.id,'provider_no_show','support_open',now(),now())
  on conflict(booking_id) do update set attendance_outcome='provider_no_show',provider_no_show_reported_at=coalesce(booking_closeouts.provider_no_show_reported_at,now()),state='support_open',updated_at=now()
  returning * into c;
  insert into public.booking_closeout_events(booking_id,actor_user_id,actor_type,event_type,note) values(b.id,auth.uid(),'customer','provider_no_show_reported',n);
  if not exists(select 1 from public.marketplace_issues where booking_id=b.id and status in('open','investigating','awaiting_information')) then
    insert into public.marketplace_issues(booking_id,service_id,reported_by,category,summary,details,priority,status)
    values(b.id,b.service_id,auth.uid(),'Provider no-show','Provider did not attend the scheduled booking.',n,'high','open') returning * into issue_row;
    insert into public.marketplace_issue_events(issue_id,booking_id,actor_user_id,actor_type,event_type,to_status,note) values(issue_row.id,b.id,auth.uid(),'customer','opened','open','Provider no-show reported.');
  end if;
  if b.provider_type='professional' then select user_id into provider_user_id from public.professional_profiles where id=b.professional_id; else select owner_user_id into provider_user_id from public.businesses where id=b.business_id; end if;
  if provider_user_id is not null then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(provider_user_id,b.id,'provider_no_show','Provider no-show reported','The customer reported that the provider did not attend. A support case is open.'); end if;
  return c;
end; $$;

create or replace function public.apply_booking_closeout_rules(target_booking_id uuid)
returns public.booking_closeouts language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; c public.booking_closeouts%rowtype; active_issue boolean; can_view boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id;
  if not found then raise exception 'Booking not found.'; end if;
  can_view := b.customer_id=auth.uid() or exists(select 1 from public.professional_profiles p where p.id=b.professional_id and p.user_id=auth.uid()) or exists(select 1 from public.businesses x where x.id=b.business_id and x.owner_user_id=auth.uid()) or exists(select 1 from public.service_ecosystem_scope ses where ses.service_id=b.service_id and ses.enabled=true and public.admin_can_view(ses.application_id,ses.location_id,ses.category_id,ses.service_id));
  if not can_view then raise exception 'Booking is not accessible.'; end if;
  select * into c from public.booking_closeouts where booking_id=b.id for update;
  if not found then return null; end if;
  select exists(select 1 from public.marketplace_issues where booking_id=b.id and status in('open','investigating','awaiting_information')) into active_issue;
  if c.closed_at is not null then return c; end if;
  if active_issue then update public.booking_closeouts set state='support_open',updated_at=now() where booking_id=b.id returning * into c; return c; end if;
  if c.close_eligible_at is not null and now()>=c.close_eligible_at and b.payment_status in('paid','refunded') then
    update public.booking_closeouts set state='closed',closed_at=now(),closed_reason='sla_window_elapsed',updated_at=now() where booking_id=b.id returning * into c;
    if not exists(select 1 from public.booking_closeout_events where booking_id=b.id and event_type='closed') then insert into public.booking_closeout_events(booking_id,actor_type,event_type,note) values(b.id,'system','closed','SLA windows elapsed with no active support case and payment settled.'); end if;
    return c;
  end if;
  if c.close_eligible_at is not null and now()>=c.close_eligible_at then update public.booking_closeouts set state='eligible_to_close',updated_at=now() where booking_id=b.id returning * into c; end if;
  return c;
end; $$;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type=any(array['booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed','reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded','review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed']::text[]));

grant execute on function public.customer_confirm_service_completion(uuid) to authenticated;
grant execute on function public.provider_report_customer_no_show(uuid,text) to authenticated;
grant execute on function public.customer_report_provider_no_show(uuid,text) to authenticated;
grant execute on function public.apply_booking_closeout_rules(uuid) to authenticated;
