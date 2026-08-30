-- Phase 16 hardening: payment-method audit history is never public/anonymous.
revoke all on public.booking_payment_method_events from anon;
grant select on public.booking_payment_method_events to authenticated;
