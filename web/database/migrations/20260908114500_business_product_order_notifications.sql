-- Business Product Order Lifecycle Notifications
--
-- Notify the opposite participant when a non-payment product order changes state.
-- Notification bodies intentionally omit Customer/Business notes and any payment details.
-- Cashfree/payment/refund/payout/settlement/reconciliation/recovery/recurrence remain untouched.

alter table public.notifications
  drop constraint notifications_event_type_check;

alter table public.notifications
  add constraint notifications_event_type_check
  check (event_type = any (array[
    'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled',
    'service_completed','reschedule_requested','reschedule_accepted','reschedule_declined',
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
    'requirement_chat_opened','message_received','moderation_report_updated','job_chat_opened',
    'job_interview_scheduled','job_interview_rescheduled','job_interview_accepted','job_interview_declined','job_interview_cancelled',
    'job_offer_issued','job_offer_accepted','job_offer_declined','job_offer_withdrawn',
    'product_order_requested','product_order_accepted','product_order_declined','product_order_fulfilled','product_order_cancelled'
  ]));

create or replace function private.notify_business_product_order_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  order_row public.business_product_orders%rowtype;
  recipient_user_id uuid;
  notification_event text;
  notification_title text;
  notification_body text;
  notification_target text;
begin
  if new.event_type not in ('requested','accepted','declined','fulfilled','cancelled') then
    return new;
  end if;

  select * into order_row
  from public.business_product_orders o
  where o.id = new.order_id;
  if not found then
    return new;
  end if;

  if new.event_type in ('requested','cancelled') then
    select b.owner_user_id into recipient_user_id
    from public.businesses b
    where b.id = order_row.business_id;
    notification_target := '/provider/orders';
  else
    recipient_user_id := order_row.customer_user_id;
    notification_target := '/orders';
  end if;

  if recipient_user_id is null then
    return new;
  end if;

  case new.event_type
    when 'requested' then
      notification_event := 'product_order_requested';
      notification_title := 'New product order request';
      notification_body := order_row.customer_name_snapshot || ' requested ' || order_row.quantity::text || ' × ' || order_row.product_name_snapshot || '.';
    when 'accepted' then
      notification_event := 'product_order_accepted';
      notification_title := 'Product order accepted';
      notification_body := order_row.business_name_snapshot || ' accepted your order request for ' || order_row.product_name_snapshot || '.';
    when 'declined' then
      notification_event := 'product_order_declined';
      notification_title := 'Product order declined';
      notification_body := order_row.business_name_snapshot || ' declined your order request for ' || order_row.product_name_snapshot || '. Open My product orders for details.';
    when 'fulfilled' then
      notification_event := 'product_order_fulfilled';
      notification_title := 'Product order fulfilled';
      notification_body := order_row.business_name_snapshot || ' marked your order for ' || order_row.product_name_snapshot || ' as fulfilled.';
    when 'cancelled' then
      notification_event := 'product_order_cancelled';
      notification_title := 'Product order cancelled';
      notification_body := order_row.customer_name_snapshot || ' cancelled the order request for ' || order_row.product_name_snapshot || '.';
  end case;

  insert into public.notifications(
    recipient_user_id,
    event_type,
    title,
    body,
    target_path
  ) values (
    recipient_user_id,
    notification_event,
    notification_title,
    notification_body,
    notification_target
  );

  return new;
end;
$$;

revoke all on function private.notify_business_product_order_event() from public, anon, authenticated;
grant execute on function private.notify_business_product_order_event() to service_role;

drop trigger if exists business_product_order_events_notify on public.business_product_order_events;
create trigger business_product_order_events_notify
after insert on public.business_product_order_events
for each row execute function private.notify_business_product_order_event();
