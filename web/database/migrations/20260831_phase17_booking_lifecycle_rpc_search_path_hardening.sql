-- Phase 17: harden Booking lifecycle / no-show / support SECURITY DEFINER RPC search paths.
--
-- These public RPCs are intentionally callable by authenticated Customer/Provider application sessions.
-- Their Next.js/server callers require the appropriate Customer or Provider session before invoking them,
-- and each function repeats its own auth.uid(), booking ownership, provider ownership, status-transition,
-- attendance-outcome, support-window, and duplicate-active-support checks before privileged work.
--
-- Every application-owned relation/type/helper reference in these function bodies is already schema-qualified
-- (public.* / auth.*). Pinning search_path to the empty path therefore removes reliance on mutable public/pg_temp
-- lookup without changing RPC signatures, EXECUTE grants, booking lifecycle semantics, no-show handling,
-- support workflow behavior, notifications, or return contracts.
--
-- Anonymous execution remains denied. Cashfree, payment, refund, payout, recovery, and finance activation
-- functions/policies are untouched.

alter function public.reschedule_owned_booking(uuid, date, time without time zone, text)
  set search_path = '';

alter function public.provider_update_booking_status(uuid, text, text)
  set search_path = '';

alter function public.customer_confirm_service_completion(uuid)
  set search_path = '';

alter function public.customer_report_provider_no_show(uuid, text)
  set search_path = '';

alter function public.provider_report_customer_no_show(uuid, text)
  set search_path = '';

alter function public.open_booking_support_case(uuid, text, text, text, text)
  set search_path = '';
