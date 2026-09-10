create or replace function public.align_service_completion_notification_attention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and new.status is distinct from old.status then
    update public.notifications n
    set body = new.service_name_snapshot || ' has been marked completed. Review the service details, confirm completion or raise an issue, then leave a review.',
        target_path = case
          when exists (
            select 1
            from public.marketplace_requirement_jobs j
            where j.booking_id = new.id
          ) then '/bookings/' || new.id::text || '#requirement-completion'
          else '/bookings/' || new.id::text
        end
    where n.booking_id = new.id
      and n.recipient_user_id = new.customer_id
      and n.event_type = 'service_completed';
  end if;

  return new;
end;
$$;

revoke all on function public.align_service_completion_notification_attention() from public, anon, authenticated;

drop trigger if exists bookings_zz_service_completion_attention on public.bookings;
create trigger bookings_zz_service_completion_attention
after update of status on public.bookings
for each row
when (new.status = 'completed' and old.status is distinct from new.status)
execute function public.align_service_completion_notification_attention();
