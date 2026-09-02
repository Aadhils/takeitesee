-- Phase 20: customer-visible status notifications for privacy and platform support requests.
-- Non-finance only. Existing booking/payment/refund/payout notification behavior is unchanged.

alter table public.notifications
  add column if not exists target_path text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.notifications'::regclass
      and conname = 'notifications_target_path_check'
  ) then
    alter table public.notifications
      add constraint notifications_target_path_check
      check (
        target_path is null
        or (
          char_length(target_path) between 1 and 256
          and left(target_path, 1) = '/'
          and left(target_path, 2) <> '//'
          and target_path !~ E'[\\r\\n]'
        )
      );
  end if;
end $$;

create or replace function private.notify_privacy_request_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_body text;
begin
  if old.status is not distinct from new.status
     and old.review_note is not distinct from new.review_note then
    return new;
  end if;

  notification_body := case new.status
    when 'in_review' then 'Your privacy request is now under review.'
    when 'awaiting_information' then 'Your privacy request needs more information. Open Account privacy to review the latest note.'
    when 'completed' then 'Your privacy request review is complete. Open Account privacy to review the outcome.'
    when 'declined' then 'Your privacy request has a new decision. Open Account privacy to review the outcome and note.'
    else 'Your privacy request has been updated. Open Account privacy for the latest status.'
  end;

  insert into public.notifications (
    recipient_user_id,
    event_type,
    title,
    body,
    target_path
  ) values (
    new.user_id,
    'support_updated',
    'Privacy request updated',
    notification_body,
    '/account/privacy'
  );

  return new;
end;
$$;

revoke all on function private.notify_privacy_request_update() from public, anon, authenticated;

drop trigger if exists privacy_request_customer_notification on public.privacy_requests;
create trigger privacy_request_customer_notification
after update on public.privacy_requests
for each row
execute function private.notify_privacy_request_update();

create or replace function private.notify_platform_support_request_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_body text;
begin
  if old.status is not distinct from new.status
     and old.review_note is not distinct from new.review_note then
    return new;
  end if;

  notification_body := case new.status
    when 'in_review' then 'Your platform support request is now under review.'
    when 'awaiting_information' then 'Your platform support request needs more information. Open Account support to review the latest note.'
    when 'resolved' then 'Your platform support request has been resolved. Open Account support to review the outcome.'
    when 'closed' then 'Your platform support request has been closed. Open Account support to review the outcome and note.'
    else 'Your platform support request has been updated. Open Account support for the latest status.'
  end;

  insert into public.notifications (
    recipient_user_id,
    event_type,
    title,
    body,
    target_path
  ) values (
    new.user_id,
    'support_updated',
    'Platform support request updated',
    notification_body,
    '/account/support'
  );

  return new;
end;
$$;

revoke all on function private.notify_platform_support_request_update() from public, anon, authenticated;

drop trigger if exists platform_support_request_customer_notification on public.platform_support_requests;
create trigger platform_support_request_customer_notification
after update on public.platform_support_requests
for each row
execute function private.notify_platform_support_request_update();
