-- Product: Employment offer + applicant decision lifecycle.
--
-- Adds a two-party consent step between interview and hired. Employers issue
-- immutable, versioned employment offers; applicants accept or decline. An
-- application becomes hired only after the applicant accepts an offer.
-- Compensation fields are informational employment terms only and do not
-- activate payroll, payments, Cashfree, payouts, settlement or finance flows.

create table if not exists public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_application_id uuid not null references public.job_applications(id) on delete cascade,
  offer_number smallint not null,
  position_title text not null,
  employment_type text not null,
  workplace_type text not null,
  location text,
  proposed_start_date date,
  compensation_minor bigint,
  compensation_currency text not null default 'INR',
  compensation_period text,
  response_deadline timestamptz,
  note text,
  status text not null default 'pending',
  issued_by_user_id uuid not null references public.users(id) on delete restrict,
  issued_at timestamptz not null default now(),
  responded_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint job_offers_number_check check (offer_number between 1 and 100),
  constraint job_offers_position_title_check check (char_length(btrim(position_title)) between 2 and 180),
  constraint job_offers_employment_type_check check (employment_type in ('full_time','part_time','contract','freelance','internship','temporary')),
  constraint job_offers_workplace_type_check check (workplace_type in ('onsite','remote','hybrid')),
  constraint job_offers_location_check check (location is null or char_length(location) <= 300),
  constraint job_offers_compensation_check check (compensation_minor is null or compensation_minor >= 0),
  constraint job_offers_currency_check check (compensation_currency in ('INR','USD')),
  constraint job_offers_period_check check (compensation_period is null or compensation_period in ('hour','day','month','year','project')),
  constraint job_offers_compensation_pair_check check (
    (compensation_minor is null and compensation_period is null)
    or (compensation_minor is not null and compensation_period is not null)
  ),
  constraint job_offers_note_check check (note is null or char_length(note) <= 3000),
  constraint job_offers_status_check check (status in ('pending','accepted','declined','withdrawn')),
  constraint job_offers_response_timestamp_check check (
    (status in ('accepted','declined') and responded_at is not null and withdrawn_at is null)
    or (status='withdrawn' and withdrawn_at is not null and responded_at is null)
    or (status='pending' and responded_at is null and withdrawn_at is null)
  ),
  constraint job_offers_application_number_unique unique(job_application_id,offer_number)
);

create unique index if not exists job_offers_one_pending_per_application_uidx
  on public.job_offers(job_application_id)
  where status='pending';
create index if not exists job_offers_application_issued_idx
  on public.job_offers(job_application_id,issued_at desc,id);
create index if not exists job_offers_issued_by_user_id_idx
  on public.job_offers(issued_by_user_id);

alter table public.job_offers enable row level security;

revoke all on table public.job_offers from public,anon,authenticated;
grant select,insert,update on table public.job_offers to authenticated;
grant select,insert,update,delete on table public.job_offers to service_role;

drop policy if exists job_offers_participant_read on public.job_offers;
create policy job_offers_participant_read
on public.job_offers for select to authenticated
using (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_offers.job_application_id
      and (profile.user_id=(select auth.uid()) or business.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists job_offers_employer_insert on public.job_offers;
create policy job_offers_employer_insert
on public.job_offers for insert to authenticated
with check (
  issued_by_user_id=(select auth.uid())
  and status='pending'
  and exists (
    select 1
    from public.job_applications application
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_offers.job_application_id
      and application.status='interview'
      and business.owner_user_id=(select auth.uid())
      and business.verified=true
  )
);

drop policy if exists job_offers_participant_update on public.job_offers;
create policy job_offers_participant_update
on public.job_offers for update to authenticated
using (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_offers.job_application_id
      and (profile.user_id=(select auth.uid()) or business.owner_user_id=(select auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_offers.job_application_id
      and (profile.user_id=(select auth.uid()) or business.owner_user_id=(select auth.uid()))
  )
);

create or replace function public.validate_job_offer_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  applicant_user uuid;
  employer_user uuid;
  business_verified boolean := false;
  application_status text;
  next_offer_number integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  select profile.user_id,business.owner_user_id,business.verified,application.status
  into applicant_user,employer_user,business_verified,application_status
  from public.job_applications application
  join public.professional_profiles profile on profile.id=application.professional_id
  join public.job_postings posting on posting.id=application.job_posting_id
  join public.businesses business on business.id=posting.business_id
  where application.id=new.job_application_id;

  if applicant_user is null or employer_user is null then
    raise exception 'Job offer participants were not found';
  end if;

  if tg_op='INSERT' then
    if actor<>employer_user then raise exception 'Only the owning employer can issue a job offer'; end if;
    if business_verified is distinct from true then raise exception 'Verified business required to issue a job offer'; end if;
    if application_status<>'interview' then raise exception 'Job offers can only be issued while the application is in interview stage'; end if;
    if new.status<>'pending' then raise exception 'New job offers must be pending'; end if;
    if new.issued_by_user_id<>actor then raise exception 'Offer issuer does not match the signed-in employer'; end if;
    if new.response_deadline is not null and new.response_deadline<=now() then
      raise exception 'Offer response deadline must be in the future';
    end if;

    select coalesce(max(offer.offer_number),0)+1
    into next_offer_number
    from public.job_offers offer
    where offer.job_application_id=new.job_application_id;

    if next_offer_number>100 then raise exception 'Maximum job offer revisions reached'; end if;
    new.offer_number := next_offer_number;
    new.issued_at := now();
    new.responded_at := null;
    new.withdrawn_at := null;
    new.updated_at := now();
    return new;
  end if;

  if new.job_application_id is distinct from old.job_application_id
     or new.offer_number is distinct from old.offer_number
     or new.position_title is distinct from old.position_title
     or new.employment_type is distinct from old.employment_type
     or new.workplace_type is distinct from old.workplace_type
     or new.location is distinct from old.location
     or new.proposed_start_date is distinct from old.proposed_start_date
     or new.compensation_minor is distinct from old.compensation_minor
     or new.compensation_currency is distinct from old.compensation_currency
     or new.compensation_period is distinct from old.compensation_period
     or new.response_deadline is distinct from old.response_deadline
     or new.note is distinct from old.note
     or new.issued_by_user_id is distinct from old.issued_by_user_id
     or new.issued_at is distinct from old.issued_at then
    raise exception 'Issued job offer terms are immutable; withdraw and issue a revised offer instead';
  end if;

  if old.status<>'pending' then raise exception 'Finalized job offers are read-only'; end if;

  if actor=applicant_user then
    if new.status not in ('accepted','declined') then
      if application_status in ('rejected','withdrawn') and new.status='withdrawn' then
        new.responded_at := null;
        new.withdrawn_at := now();
      else
        raise exception 'Applicant can only accept or decline a pending job offer';
      end if;
    else
      if new.status='accepted' and application_status<>'interview' then
        raise exception 'Application is no longer eligible for offer acceptance';
      end if;
      if new.response_deadline is not null and new.response_deadline<now() then
        raise exception 'This job offer response deadline has passed';
      end if;
      new.responded_at := now();
      new.withdrawn_at := null;
    end if;
  elsif actor=employer_user then
    if new.status<>'withdrawn' then
      raise exception 'Employer can only withdraw a pending job offer';
    end if;
    new.responded_at := null;
    new.withdrawn_at := now();
  else
    raise exception 'Job offer update not permitted';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_job_offer_mutation() from public,anon,authenticated;

drop trigger if exists job_offers_validate_mutation on public.job_offers;
create trigger job_offers_validate_mutation
before insert or update on public.job_offers
for each row execute function public.validate_job_offer_mutation();

-- Replace application transition guard so hiring is no longer an employer-only action.
-- The applicant-side interview -> hired transition is allowed only after an accepted
-- offer exists, and is normally driven atomically by the offer acceptance trigger.
create or replace function public.validate_job_application_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  applicant_owner boolean := false;
  employer_owner boolean := false;
  accepted_offer_exists boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if new.job_posting_id is distinct from old.job_posting_id
     or new.professional_id is distinct from old.professional_id
     or new.selected_professional_role_id is distinct from old.selected_professional_role_id
     or new.cover_note is distinct from old.cover_note
     or new.applied_at is distinct from old.applied_at then
    raise exception 'Application identity and submitted content are immutable';
  end if;

  select exists (
    select 1 from public.professional_profiles profile
    where profile.id=old.professional_id and profile.user_id=actor
  ) into applicant_owner;

  select exists (
    select 1
    from public.job_postings posting
    join public.businesses business on business.id=posting.business_id
    where posting.id=old.job_posting_id and business.owner_user_id=actor
  ) into employer_owner;

  if applicant_owner then
    if new.status='withdrawn' and old.status in ('submitted','shortlisted','interview') then
      null;
    elsif old.status='interview' and new.status='hired' then
      select exists (
        select 1 from public.job_offers offer
        where offer.job_application_id=old.id and offer.status='accepted'
      ) into accepted_offer_exists;
      if not accepted_offer_exists then
        raise exception 'A job application can become hired only after the applicant accepts an employment offer';
      end if;
    else
      raise exception 'Applicant can only withdraw an active application or accept an employment offer';
    end if;
  elsif employer_owner then
    if not (
      (old.status='submitted' and new.status in ('shortlisted','interview','rejected'))
      or (old.status='shortlisted' and new.status in ('interview','rejected'))
      or (old.status='interview' and new.status='rejected')
    ) then
      raise exception 'Employer cannot mark an applicant hired directly; issue an employment offer and wait for applicant acceptance';
    end if;
  else
    raise exception 'Application update not permitted';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_job_application_update() from public,anon,authenticated;

create or replace function private.complete_job_application_from_accepted_offer()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status='accepted' and old.status is distinct from new.status then
    update public.job_applications
    set status='hired'
    where id=new.job_application_id and status='interview';

    if not found then
      raise exception 'Application could not transition to hired after offer acceptance';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.complete_job_application_from_accepted_offer() from public,anon,authenticated;

drop trigger if exists job_offers_complete_application on public.job_offers;
create trigger job_offers_complete_application
after update of status on public.job_offers
for each row execute function private.complete_job_application_from_accepted_offer();

create or replace function private.close_pending_job_offers_for_terminal_application()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status in ('rejected','withdrawn') and old.status is distinct from new.status then
    update public.job_offers
    set status='withdrawn'
    where job_application_id=new.id and status='pending';
  end if;
  return new;
end;
$$;
revoke all on function private.close_pending_job_offers_for_terminal_application() from public,anon,authenticated;

drop trigger if exists job_applications_close_pending_offers on public.job_applications;
create trigger job_applications_close_pending_offers
after update of status on public.job_applications
for each row execute function private.close_pending_job_offers_for_terminal_application();

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications
  add constraint notifications_event_type_check check (event_type in (
    'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
    'reschedule_requested','reschedule_accepted','reschedule_declined',
    'payment_pending','payment_paid','payment_failed','payment_refunded',
    'review_submitted','review_response','support_opened','support_updated',
    'customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
    'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
    'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
    'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
    'provider_reverification_required','provider_suspended','provider_restored',
    'provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed','provider_payout_destination_updated',
    'refund_requested','refund_onhold','refund_failed','refund_cancelled',
    'payment_dispute_opened','payment_dispute_resolved','provider_finance_hold','provider_recovery_required','provider_recovery_resolved',
    'requirement_chat_opened','message_received','moderation_report_updated',
    'job_chat_opened','job_interview_scheduled','job_interview_rescheduled','job_interview_accepted','job_interview_declined','job_interview_cancelled',
    'job_offer_issued','job_offer_accepted','job_offer_declined','job_offer_withdrawn'
  ));

create or replace function private.notify_job_offer_lifecycle()
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
  recipient uuid;
  event_value text;
  notification_title text;
  notification_body text;
begin
  if actor is null then raise exception 'Authenticated job offer actor required'; end if;

  select profile.user_id,business.owner_user_id,posting.title
  into applicant_user,employer_user,job_title
  from public.job_applications application
  join public.professional_profiles profile on profile.id=application.professional_id
  join public.job_postings posting on posting.id=application.job_posting_id
  join public.businesses business on business.id=posting.business_id
  where application.id=new.job_application_id;

  if applicant_user is null or employer_user is null then
    raise exception 'Job offer participants were not found';
  end if;

  if tg_op='INSERT' then
    recipient := applicant_user;
    event_value := 'issued';
    notification_title := 'Employment offer received';
    notification_body := 'You received an employment offer for '||job_title||'.';
  elsif new.status='accepted' and old.status is distinct from new.status then
    recipient := employer_user;
    event_value := 'accepted';
    notification_title := 'Employment offer accepted';
    notification_body := 'The applicant accepted the employment offer for '||job_title||'.';
  elsif new.status='declined' and old.status is distinct from new.status then
    recipient := employer_user;
    event_value := 'declined';
    notification_title := 'Employment offer declined';
    notification_body := 'The applicant declined the employment offer for '||job_title||'.';
  elsif new.status='withdrawn' and old.status is distinct from new.status and actor=employer_user then
    recipient := applicant_user;
    event_value := 'withdrawn';
    notification_title := 'Employment offer withdrawn';
    notification_body := 'The employer withdrew the pending employment offer for '||job_title||'.';
  else
    return new;
  end if;

  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(recipient,'job_offer_'||event_value,notification_title,notification_body,'/provider/jobs');

  return new;
end;
$$;
revoke all on function private.notify_job_offer_lifecycle() from public,anon,authenticated;

drop trigger if exists job_offers_notify_lifecycle on public.job_offers;
create trigger job_offers_notify_lifecycle
after insert or update of status on public.job_offers
for each row execute function private.notify_job_offer_lifecycle();

comment on table public.job_offers is
  'Versioned, immutable employment offer terms between an owning Business employer and a Professional applicant. Offer compensation is informational and not a TakeItEsee payment or payroll transaction.';
comment on column public.job_offers.compensation_minor is
  'Optional informational employment compensation term in minor currency units; does not activate platform finance, payout, settlement or payroll behavior.';
