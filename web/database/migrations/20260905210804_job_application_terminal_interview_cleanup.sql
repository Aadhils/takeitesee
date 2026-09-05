create or replace function public.validate_job_interview_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  applicant_owner boolean := false;
  employer_owner boolean := false;
  schedule_changed boolean := false;
  application_status text;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  if new.meeting_url is not null and new.meeting_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Meeting URL must be a valid HTTPS URL';
  end if;

  if tg_op='INSERT' then
    if new.status<>'scheduled' then raise exception 'New interviews must be scheduled'; end if;
    if new.scheduled_by_user_id<>actor then raise exception 'Interview scheduler does not match the signed-in employer'; end if;
    if new.starts_at <= now() then raise exception 'Interview must be scheduled in the future'; end if;
    return new;
  end if;

  if new.job_application_id is distinct from old.job_application_id
     or new.scheduled_by_user_id is distinct from old.scheduled_by_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Interview identity is immutable';
  end if;

  select application.status
  into application_status
  from public.job_applications application
  where application.id=old.job_application_id;

  select exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    where application.id=old.job_application_id and profile.user_id=actor
  ) into applicant_owner;

  select exists (
    select 1
    from public.job_applications application
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=old.job_application_id and business.owner_user_id=actor
  ) into employer_owner;

  schedule_changed :=
    new.starts_at is distinct from old.starts_at
    or new.duration_minutes is distinct from old.duration_minutes
    or new.timezone is distinct from old.timezone
    or new.mode is distinct from old.mode
    or new.location is distinct from old.location
    or new.meeting_url is distinct from old.meeting_url
    or new.note is distinct from old.note;

  if application_status in ('hired','rejected','withdrawn')
     and new.status='cancelled'
     and old.status in ('scheduled','accepted')
     and not schedule_changed
     and (applicant_owner or employer_owner) then
    new.cancelled_at := coalesce(new.cancelled_at,now());
    new.updated_at := now();
    return new;
  end if;

  if applicant_owner then
    if schedule_changed then raise exception 'Applicant cannot alter interview schedule details'; end if;
    if old.status<>'scheduled' or new.status not in ('accepted','declined') then
      raise exception 'Applicant can only accept or decline a scheduled interview';
    end if;
    new.responded_at := now();
    new.cancelled_at := null;
  elsif employer_owner then
    if new.status='cancelled' then
      if old.status not in ('scheduled','accepted','declined') then raise exception 'Interview cannot be cancelled from its current state'; end if;
      if schedule_changed then raise exception 'Cancel the interview without changing its schedule'; end if;
      new.cancelled_at := now();
    elsif new.status='scheduled' then
      if old.status not in ('scheduled','accepted','declined') then raise exception 'Interview cannot be rescheduled from its current state'; end if;
      if not schedule_changed then raise exception 'Change the schedule when rescheduling an interview'; end if;
      if new.starts_at <= now() then raise exception 'Rescheduled interview must be in the future'; end if;
      new.responded_at := null;
      new.cancelled_at := null;
    else
      raise exception 'Employer can only reschedule or cancel an interview';
    end if;
  else
    raise exception 'Interview update not permitted';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_job_interview_mutation() from public,anon,authenticated;

create or replace function public.audit_and_notify_job_interview()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  applicant_user uuid;
  employer_user uuid;
  job_title text;
  event_value text;
  recipient uuid;
begin
  if actor is null then raise exception 'Authenticated interview actor required'; end if;

  select profile.user_id,business.owner_user_id,posting.title
  into applicant_user,employer_user,job_title
  from public.job_applications application
  join public.professional_profiles profile on profile.id=application.professional_id
  join public.job_postings posting on posting.id=application.job_posting_id
  join public.businesses business on business.id=posting.business_id
  where application.id=new.job_application_id;

  if applicant_user is null or employer_user is null then raise exception 'Interview participants were not found'; end if;

  if tg_op='INSERT' then
    event_value := 'scheduled';
    recipient := applicant_user;
  elsif new.status='cancelled' and old.status is distinct from new.status then
    event_value := 'cancelled';
    recipient := case when actor=applicant_user then employer_user else applicant_user end;
  elsif new.status='accepted' and old.status is distinct from new.status then
    event_value := 'accepted';
    recipient := employer_user;
  elsif new.status='declined' and old.status is distinct from new.status then
    event_value := 'declined';
    recipient := employer_user;
  elsif new.status='scheduled' and (
    new.starts_at is distinct from old.starts_at
    or new.duration_minutes is distinct from old.duration_minutes
    or new.timezone is distinct from old.timezone
    or new.mode is distinct from old.mode
    or new.location is distinct from old.location
    or new.meeting_url is distinct from old.meeting_url
    or new.note is distinct from old.note
  ) then
    event_value := 'rescheduled';
    recipient := applicant_user;
  else
    return new;
  end if;

  insert into public.job_interview_events(
    interview_id,job_application_id,actor_user_id,event_type,starts_at,duration_minutes,timezone,mode,location,meeting_url,interview_status,note
  ) values (
    new.id,new.job_application_id,actor,event_value,new.starts_at,new.duration_minutes,new.timezone,new.mode,new.location,new.meeting_url,new.status,new.note
  );

  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(
    recipient,
    'job_interview_'||event_value,
    case event_value
      when 'scheduled' then 'Interview scheduled'
      when 'rescheduled' then 'Interview rescheduled'
      when 'accepted' then 'Interview accepted'
      when 'declined' then 'Interview declined'
      else 'Interview cancelled'
    end,
    case event_value
      when 'scheduled' then 'An interview was scheduled for '||job_title||'.'
      when 'rescheduled' then 'The interview schedule changed for '||job_title||'.'
      when 'accepted' then 'The applicant accepted the interview for '||job_title||'.'
      when 'declined' then 'The applicant declined the interview for '||job_title||'.'
      else 'The interview was cancelled for '||job_title||'.'
    end,
    '/provider/jobs'
  );

  return new;
end;
$$;

revoke all on function public.audit_and_notify_job_interview() from public,anon,authenticated;

create or replace function private.close_active_job_interviews_for_terminal_application()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('hired','rejected','withdrawn') and old.status is distinct from new.status then
    update public.job_interviews
    set status='cancelled',cancelled_at=now(),updated_at=now()
    where job_application_id=new.id and status in ('scheduled','accepted');
  end if;
  return new;
end;
$$;

revoke all on function private.close_active_job_interviews_for_terminal_application() from public,anon,authenticated;

drop trigger if exists job_applications_close_active_interviews on public.job_applications;
create trigger job_applications_close_active_interviews
after update of status on public.job_applications
for each row execute function private.close_active_job_interviews_for_terminal_application();