-- Phase 12 Module 7: completion -> review -> support handoff -> closeout foundation.

alter table public.reviews
  add column if not exists provider_response text,
  add column if not exists provider_responded_at timestamptz,
  add column if not exists provider_response_updated_at timestamptz;

alter table public.reviews drop constraint if exists reviews_provider_response_length_check;
alter table public.reviews add constraint reviews_provider_response_length_check
  check (provider_response is null or char_length(provider_response) <= 1000);

alter table public.marketplace_issues
  add column if not exists resolution_note text,
  add column if not exists handled_by uuid;

alter table public.marketplace_issues drop constraint if exists marketplace_issues_resolution_note_length_check;
alter table public.marketplace_issues add constraint marketplace_issues_resolution_note_length_check
  check (resolution_note is null or char_length(resolution_note) <= 2000);

create table if not exists public.marketplace_issue_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.marketplace_issues(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  actor_user_id uuid,
  actor_type text not null check (actor_type in ('customer','provider','admin','system')),
  event_type text not null check (event_type in ('opened','status_changed','note')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_issue_events_issue_created_idx
  on public.marketplace_issue_events(issue_id, created_at);
create index if not exists marketplace_issue_events_booking_created_idx
  on public.marketplace_issue_events(booking_id, created_at);

create unique index if not exists marketplace_issues_one_active_per_booking_idx
  on public.marketplace_issues(booking_id)
  where status in ('open','investigating','awaiting_information');

alter table public.marketplace_issue_events enable row level security;

drop policy if exists marketplace_issue_events_customer_read on public.marketplace_issue_events;
create policy marketplace_issue_events_customer_read
on public.marketplace_issue_events for select to authenticated
using (
  exists (
    select 1 from public.marketplace_issues i
    where i.id = marketplace_issue_events.issue_id
      and i.reported_by = auth.uid()
  )
);

drop policy if exists marketplace_issue_events_provider_read on public.marketplace_issue_events;
create policy marketplace_issue_events_provider_read
on public.marketplace_issue_events for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = marketplace_issue_events.booking_id
      and (
        exists (select 1 from public.professional_profiles p where p.id = b.professional_id and p.user_id = auth.uid())
        or exists (select 1 from public.businesses biz where biz.id = b.business_id and biz.owner_user_id = auth.uid())
      )
  )
);

drop policy if exists marketplace_issue_events_admin_read_scoped on public.marketplace_issue_events;
create policy marketplace_issue_events_admin_read_scoped
on public.marketplace_issue_events for select to authenticated
using (
  exists (
    select 1
    from public.marketplace_issues i
    join public.service_ecosystem_scope ses on ses.service_id = i.service_id and ses.enabled = true
    where i.id = marketplace_issue_events.issue_id
      and public.admin_can_view(ses.application_id, ses.location_id, ses.category_id, ses.service_id)
  )
);

drop policy if exists marketplace_issues_provider_read_owned on public.marketplace_issues;
create policy marketplace_issues_provider_read_owned
on public.marketplace_issues for select to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = marketplace_issues.booking_id
      and (
        exists (select 1 from public.professional_profiles p where p.id = b.professional_id and p.user_id = auth.uid())
        or exists (select 1 from public.businesses biz where biz.id = b.business_id and biz.owner_user_id = auth.uid())
      )
  )
);

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check
check (event_type = any (array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined',
  'payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated'
]::text[]));

create or replace function public.notify_provider_of_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  provider_user_id uuid;
begin
  if new.provider_type = 'professional' then
    select user_id into provider_user_id from public.professional_profiles where id = new.professional_id;
  else
    select owner_user_id into provider_user_id from public.businesses where id = new.business_id;
  end if;

  if provider_user_id is not null then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (provider_user_id, new.booking_id, 'review_submitted', 'New customer review', 'A customer submitted a review for a completed service.');
  end if;
  return new;
end;
$$;

drop trigger if exists reviews_notify_provider on public.reviews;
create trigger reviews_notify_provider
after insert on public.reviews
for each row execute function public.notify_provider_of_review();

create or replace function public.respond_to_owned_review(target_review_id uuid, response_text text)
returns public.reviews
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  response_value text := btrim(coalesce(response_text, ''));
  review_row public.reviews%rowtype;
  owns_review boolean := false;
  had_response boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(response_value) < 3 then raise exception 'A response of at least 3 characters is required.'; end if;
  if char_length(response_value) > 1000 then raise exception 'Response must be 1000 characters or fewer.'; end if;

  select * into review_row from public.reviews where id = target_review_id for update;
  if not found then raise exception 'Review not found.'; end if;
  if review_row.status <> 'published' then raise exception 'Only published reviews can receive a provider response.'; end if;

  if review_row.provider_type = 'professional' then
    select exists(select 1 from public.professional_profiles p where p.id = review_row.professional_id and p.user_id = auth.uid()) into owns_review;
  else
    select exists(select 1 from public.businesses b where b.id = review_row.business_id and b.owner_user_id = auth.uid()) into owns_review;
  end if;
  if not owns_review then raise exception 'Review is not owned by this provider.'; end if;

  had_response := review_row.provider_response is not null;
  update public.reviews
  set provider_response = response_value,
      provider_responded_at = coalesce(provider_responded_at, now()),
      provider_response_updated_at = now(),
      updated_at = now()
  where id = target_review_id
  returning * into review_row;

  insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
  values (
    review_row.customer_id,
    review_row.booking_id,
    'review_response',
    case when had_response then 'Provider updated their review response' else 'Provider responded to your review' end,
    'Open the booking to read the provider response.'
  );

  return review_row;
end;
$$;

create or replace function public.open_booking_support_case(
  target_booking_id uuid,
  issue_category text,
  issue_summary text,
  issue_details text default null,
  issue_priority text default 'medium'
)
returns public.marketplace_issues
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
  issue_row public.marketplace_issues%rowtype;
  category_value text := btrim(coalesce(issue_category, ''));
  summary_value text := btrim(coalesce(issue_summary, ''));
  details_value text := nullif(btrim(coalesce(issue_details, '')), '');
  provider_user_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(category_value) < 2 or char_length(category_value) > 80 then raise exception 'Choose a valid support category.'; end if;
  if char_length(summary_value) < 3 or char_length(summary_value) > 180 then raise exception 'Support summary must be 3 to 180 characters.'; end if;
  if details_value is not null and char_length(details_value) > 2000 then raise exception 'Support details must be 2000 characters or fewer.'; end if;
  if issue_priority not in ('low','medium','high','urgent') then raise exception 'Support priority is invalid.'; end if;

  select * into booking_row from public.bookings where id = target_booking_id and customer_id = auth.uid();
  if not found then raise exception 'Booking not found.'; end if;

  if exists (
    select 1 from public.marketplace_issues
    where booking_id = target_booking_id and status in ('open','investigating','awaiting_information')
  ) then
    raise exception 'An active support case already exists for this booking.';
  end if;

  insert into public.marketplace_issues(booking_id, service_id, reported_by, category, summary, details, priority, status)
  values (booking_row.id, booking_row.service_id, auth.uid(), category_value, summary_value, details_value, issue_priority, 'open')
  returning * into issue_row;

  insert into public.marketplace_issue_events(issue_id, booking_id, actor_user_id, actor_type, event_type, to_status, note)
  values (issue_row.id, booking_row.id, auth.uid(), 'customer', 'opened', 'open', summary_value);

  if booking_row.provider_type = 'professional' then
    select user_id into provider_user_id from public.professional_profiles where id = booking_row.professional_id;
  else
    select owner_user_id into provider_user_id from public.businesses where id = booking_row.business_id;
  end if;

  insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
  values (auth.uid(), booking_row.id, 'support_opened', 'Support case opened', 'Your support request has been recorded and is now in the operations queue.');

  if provider_user_id is not null then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (provider_user_id, booking_row.id, 'support_opened', 'Support case opened', 'A customer opened a support case linked to this booking.');
  end if;

  return issue_row;
end;
$$;

create or replace function public.update_marketplace_issue(
  target_issue_id uuid,
  new_status text,
  admin_note text default null
)
returns public.marketplace_issues
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  issue_row public.marketplace_issues%rowtype;
  old_status text;
  note_value text := nullif(btrim(coalesce(admin_note, '')), '');
  provider_user_id uuid;
  booking_row public.bookings%rowtype;
  can_manage_issue boolean := false;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if new_status not in ('open','investigating','awaiting_information','resolved','closed') then raise exception 'Issue status is invalid.'; end if;
  if note_value is not null and char_length(note_value) > 2000 then raise exception 'Resolution note must be 2000 characters or fewer.'; end if;
  if new_status in ('resolved','closed') and coalesce(char_length(note_value),0) < 3 then raise exception 'A resolution note is required to resolve or close a case.'; end if;

  select * into issue_row from public.marketplace_issues where id = target_issue_id for update;
  if not found then raise exception 'Support case not found.'; end if;

  select exists(
    select 1 from public.service_ecosystem_scope ses
    where ses.service_id = issue_row.service_id
      and ses.enabled = true
      and public.admin_can_manage(ses.application_id, ses.location_id, ses.category_id, ses.service_id)
  ) into can_manage_issue;
  if not can_manage_issue then raise exception 'Admin manage permission is required for this support case.'; end if;

  old_status := issue_row.status;
  update public.marketplace_issues
  set status = new_status,
      resolution_note = case when note_value is not null then note_value else resolution_note end,
      handled_by = auth.uid(),
      updated_at = now(),
      resolved_at = case when new_status in ('resolved','closed') then now() else null end
  where id = target_issue_id
  returning * into issue_row;

  insert into public.marketplace_issue_events(issue_id, booking_id, actor_user_id, actor_type, event_type, from_status, to_status, note)
  values (issue_row.id, issue_row.booking_id, auth.uid(), 'admin', 'status_changed', old_status, new_status, note_value);

  select * into booking_row from public.bookings where id = issue_row.booking_id;

  insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
  values (issue_row.reported_by, issue_row.booking_id, 'support_updated', 'Support case updated', 'Your support case is now ' || replace(new_status, '_', ' ') || '.');

  if booking_row.provider_type = 'professional' then
    select user_id into provider_user_id from public.professional_profiles where id = booking_row.professional_id;
  else
    select owner_user_id into provider_user_id from public.businesses where id = booking_row.business_id;
  end if;
  if provider_user_id is not null then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (provider_user_id, issue_row.booking_id, 'support_updated', 'Support case updated', 'The linked support case is now ' || replace(new_status, '_', ' ') || '.');
  end if;

  return issue_row;
end;
$$;

grant execute on function public.respond_to_owned_review(uuid, text) to authenticated;
grant execute on function public.open_booking_support_case(uuid, text, text, text, text) to authenticated;
grant execute on function public.update_marketplace_issue(uuid, text, text) to authenticated;
