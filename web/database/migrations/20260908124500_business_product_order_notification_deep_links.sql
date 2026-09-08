-- Business Product Order Notification Deep Links
--
-- Route product-order lifecycle notifications directly to the relevant Customer
-- or Business order card. This changes navigation only; order state, payment,
-- Cashfree, refund, payout, settlement, reconciliation, recovery, recurrence,
-- and inventory behavior remain untouched.

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
    notification_target := '/provider/orders#order-' || order_row.id::text;
  else
    recipient_user_id := order_row.customer_user_id;
    notification_target := '/orders#order-' || order_row.id::text;
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
