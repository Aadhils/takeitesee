create or replace function public.emit_booking_notifications()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  provider_user_id uuid;
  customer_title text;
  customer_body text;
  provider_title text;
  provider_body text;
  event_name text;
begin
  if new.provider_type = 'business' then select owner_user_id into provider_user_id from public.businesses where id = new.business_id;
  else select user_id into provider_user_id from public.professional_profiles where id = new.professional_id; end if;
  if tg_op = 'INSERT' then
    event_name := 'booking_created'; customer_title := 'Booking request sent'; customer_body := new.service_name_snapshot || ' is awaiting provider confirmation.';
    provider_title := 'New booking request'; provider_body := 'A customer requested ' || new.service_name_snapshot || ' for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      if old.status = 'rescheduled' then
        event_name := 'reschedule_accepted'; customer_title := 'New time confirmed'; customer_body := new.service_name_snapshot || ' is confirmed for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
        provider_title := 'Reschedule confirmed'; provider_body := 'You confirmed the new time for ' || new.service_name_snapshot || '.';
      else
        event_name := 'booking_accepted'; customer_title := 'Booking confirmed'; customer_body := new.service_name_snapshot || ' has been confirmed by the provider.';
        provider_title := 'Booking confirmed'; provider_body := new.service_name_snapshot || ' is confirmed for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
      end if;
    elsif new.status = 'cancelled' then
      if provider_user_id is not null and auth.uid() = provider_user_id and auth.uid() is distinct from new.customer_id then
        event_name := case when old.status = 'rescheduled' then 'reschedule_declined' else 'booking_declined' end;
        customer_title := case when old.status = 'rescheduled' then 'New time declined' else 'Booking declined' end;
        customer_body := case when old.status = 'rescheduled' then 'The provider could not accept the new time for ' || new.service_name_snapshot || '.' else new.service_name_snapshot || ' was declined by the provider.' end;
        provider_title := customer_title;
        provider_body := case when old.status = 'rescheduled' then 'You declined the reschedule request for ' || new.service_name_snapshot || '.' else 'You declined the booking request for ' || new.service_name_snapshot || '.' end;
      else
        event_name := 'booking_cancelled'; customer_title := 'Booking cancelled'; customer_body := new.service_name_snapshot || ' has been cancelled.';
        provider_title := 'Booking cancelled'; provider_body := 'The customer cancelled the booking for ' || new.service_name_snapshot || '.';
      end if;
    elsif new.status = 'rescheduled' then
      event_name := 'reschedule_requested'; customer_title := 'Reschedule request sent'; customer_body := 'Your new time for ' || new.service_name_snapshot || ' is awaiting provider confirmation.';
      provider_title := 'New reschedule request'; provider_body := new.service_name_snapshot || ' was moved to ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '. Please confirm the new time.';
    elsif new.status = 'completed' then
      event_name := 'service_completed'; customer_title := 'Service completed'; customer_body := new.service_name_snapshot || ' has been marked completed. You can now leave a review.';
      provider_title := 'Service completed'; provider_body := new.service_name_snapshot || ' has been marked completed.';
    else return new; end if;
  elsif (new.booking_date is distinct from old.booking_date or new.start_time is distinct from old.start_time) and new.status = 'rescheduled' then
    event_name := 'reschedule_requested'; customer_title := 'Reschedule request sent'; customer_body := 'Your new time for ' || new.service_name_snapshot || ' is awaiting provider confirmation.';
    provider_title := 'New reschedule request'; provider_body := new.service_name_snapshot || ' was moved to ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '. Please confirm the new time.';
  else return new; end if;
  if new.customer_id is not null then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body, target_path)
    values (new.customer_id, new.id, event_name, customer_title, customer_body, '/bookings/' || new.id::text);
  end if;
  if provider_user_id is not null and provider_user_id is distinct from new.customer_id then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body, target_path)
    values (provider_user_id, new.id, event_name, provider_title, provider_body, '/provider/bookings/' || new.id::text);
  end if;
  return new;
end;
$function$;
