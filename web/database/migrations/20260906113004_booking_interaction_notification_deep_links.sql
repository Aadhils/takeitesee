create or replace function public.assign_booking_interaction_notification_target()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  booking_customer_id uuid;
begin
  if new.target_path is not null or new.booking_id is null then
    return new;
  end if;

  case new.event_type
    when 'completion_confirmed' then
      new.target_path := '/provider/bookings/' || new.booking_id::text;
    when 'provider_no_show' then
      new.target_path := '/provider/bookings/' || new.booking_id::text;
    when 'customer_no_show' then
      new.target_path := '/bookings/' || new.booking_id::text;
    when 'review_response' then
      new.target_path := '/bookings/' || new.booking_id::text;
    when 'review_submitted' then
      new.target_path := '/provider/reviews';
    when 'support_opened' then
      select b.customer_id into booking_customer_id
      from public.bookings b
      where b.id = new.booking_id;
      if booking_customer_id is not null and new.recipient_user_id = booking_customer_id then
        new.target_path := '/bookings/' || new.booking_id::text;
      else
        new.target_path := '/provider/bookings/' || new.booking_id::text;
      end if;
    when 'support_updated' then
      select b.customer_id into booking_customer_id
      from public.bookings b
      where b.id = new.booking_id;
      if booking_customer_id is not null and new.recipient_user_id = booking_customer_id then
        new.target_path := '/bookings/' || new.booking_id::text;
      else
        new.target_path := '/provider/bookings/' || new.booking_id::text;
      end if;
    else
      null;
  end case;

  return new;
end;
$function$;

revoke all on function public.assign_booking_interaction_notification_target() from public, anon, authenticated;
grant execute on function public.assign_booking_interaction_notification_target() to service_role;

drop trigger if exists notifications_assign_booking_interaction_target on public.notifications;
create trigger notifications_assign_booking_interaction_target
before insert on public.notifications
for each row execute function public.assign_booking_interaction_notification_target();
