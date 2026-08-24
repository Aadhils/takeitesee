create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  event_type text not null check (event_type in ('booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz null
);

create index if not exists notifications_recipient_created_idx on public.notifications(recipient_user_id, created_at desc);
create index if not exists notifications_booking_idx on public.notifications(booking_id);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (recipient_user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

create or replace function public.emit_booking_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_user_id uuid;
  customer_title text;
  customer_body text;
  provider_title text;
  provider_body text;
  event_name text;
begin
  if new.provider_type = 'business' then
    select owner_user_id into provider_user_id from public.businesses where id = new.business_id;
  else
    select user_id into provider_user_id from public.professional_profiles where id = new.professional_id;
  end if;

  if tg_op = 'INSERT' then
    event_name := 'booking_created';
    customer_title := 'Booking request sent';
    customer_body := new.service_name_snapshot || ' is awaiting provider confirmation.';
    provider_title := 'New booking request';
    provider_body := 'A customer requested ' || new.service_name_snapshot || ' for ' || new.booking_date::text || ' at ' || left(new.start_time::text,5) || '.';
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      event_name := 'booking_accepted';
      customer_title := 'Booking confirmed';
      customer_body := new.service_name_snapshot || ' has been confirmed by the provider.';
      provider_title := 'Booking confirmed';
      provider_body := new.service_name_snapshot || ' is confirmed for ' || new.booking_date::text || ' at ' || left(new.start_time::text,5) || '.';
    elsif new.status = 'cancelled' then
      event_name := 'booking_cancelled';
      customer_title := 'Booking cancelled';
      customer_body := new.service_name_snapshot || ' has been cancelled.';
      provider_title := 'Booking cancelled';
      provider_body := 'The booking for ' || new.service_name_snapshot || ' has been cancelled.';
    elsif new.status = 'rescheduled' then
      event_name := 'booking_rescheduled';
      customer_title := 'Booking rescheduled';
      customer_body := new.service_name_snapshot || ' is now scheduled for ' || new.booking_date::text || ' at ' || left(new.start_time::text,5) || '.';
      provider_title := 'Booking rescheduled';
      provider_body := new.service_name_snapshot || ' moved to ' || new.booking_date::text || ' at ' || left(new.start_time::text,5) || '.';
    elsif new.status = 'completed' then
      event_name := 'service_completed';
      customer_title := 'Service completed';
      customer_body := new.service_name_snapshot || ' has been marked completed. You can now leave a review.';
      provider_title := 'Service completed';
      provider_body := new.service_name_snapshot || ' has been marked completed.';
    elsif new.status = 'rejected' then
      event_name := 'booking_declined';
      customer_title := 'Booking declined';
      customer_body := new.service_name_snapshot || ' was declined by the provider.';
      provider_title := 'Booking declined';
      provider_body := new.service_name_snapshot || ' was declined.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if new.customer_id is not null then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (new.customer_id, new.id, event_name, customer_title, customer_body);
  end if;

  if provider_user_id is not null and provider_user_id is distinct from new.customer_id then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (provider_user_id, new.id, event_name, provider_title, provider_body);
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_emit_notifications on public.bookings;
create trigger bookings_emit_notifications
after insert or update of status, booking_date, start_time on public.bookings
for each row execute function public.emit_booking_notifications();
