-- Fix PL/pgSQL record-variable shadowing in the sanitized booking finance-risk timeline.
create or replace function public.get_booking_finance_risk_events(target_booking_id uuid)
returns table(id text,event_kind text,status text,title text,detail text,occurred_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype;
  allowed boolean:=false;
  owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select bk.* into booking_row from public.bookings bk where bk.id=target_booking_id;
  if not found then return; end if;
  owner_id:=public.internal_provider_owner_for_booking(target_booking_id);
  allowed:=booking_row.customer_id=auth.uid() or owner_id=auth.uid() or public.is_super_admin() or public.admin_can_view(null,null,null,booking_row.service_id);
  if not allowed then return; end if;
  return query
    select 'dispute:'||e.id::text,'dispute',e.to_local_state,
      case when e.to_local_state='action_required' then 'Payment dispute opened' when e.to_local_state='under_review' then 'Payment dispute under review' when e.to_local_state='won' then 'Payment dispute resolved' when e.to_local_state in ('lost','accepted','recovery_required') then 'Payment dispute closed with financial impact' else 'Payment dispute updated' end,
      case when e.to_local_state='action_required' then 'The payment gateway reported a dispute for this booking. Finance review is in progress.' when e.to_local_state='under_review' then 'The payment dispute is under review with the payment gateway.' when e.to_local_state='won' then 'The payment dispute was resolved in the merchant’s favour.' when e.to_local_state in ('lost','accepted','recovery_required') then 'The dispute closed with a payment reversal or finance recovery requirement.' else 'The payment dispute status changed.' end,
      e.recorded_at from public.payment_dispute_events e where e.booking_id=target_booking_id
    union all
    select 'exception:'||x.id::text,'gateway_exception',x.to_status,
      case when x.category in ('auto_refund','partial_auto_refund') then 'Automatic payment refund' else 'Payment reconciliation review' end,
      case when x.category='auto_refund' and x.to_status='resolved' then 'Cashfree automatically refunded the payment and the booking payment ledger was reconciled.' when x.category in ('auto_refund','partial_auto_refund') then 'The payment gateway automatically refunded all or part of a payment. Finance reconciliation is in progress.' else 'A payment gateway reconciliation exception is being reviewed.' end,
      x.recorded_at from public.payment_gateway_exception_events x where x.booking_id=target_booking_id;
end; $$;
revoke all on function public.get_booking_finance_risk_events(uuid) from public,anon;
grant execute on function public.get_booking_finance_risk_events(uuid) to authenticated;
