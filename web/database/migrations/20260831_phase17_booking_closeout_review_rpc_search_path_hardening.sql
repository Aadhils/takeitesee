-- Phase 17: harden booking conflict, closeout, and provider review SECURITY DEFINER RPC search paths.
--
-- These public RPCs are intentional authenticated application endpoints. Their callers and function bodies
-- enforce customer/provider/admin authorization before privileged work, and anonymous execution is denied.
--
-- Every application-owned relation, type, and helper reference used by these functions is schema-qualified
-- (public.* / auth.*). Pinning search_path to the empty path therefore removes reliance on mutable public/pg_temp
-- lookup without changing RPC signatures, EXECUTE grants, booking conflict semantics, closeout authorization,
-- review-response ownership rules, notifications, or return contracts.
--
-- apply_booking_closeout_rules() may inspect the existing booking payment-settlement state as part of its
-- already-established closeout rules; this migration does not change payment logic, Cashfree configuration,
-- payment/refund/payout/recovery activation, finance policies, credentials, or grants.

alter function public.get_reschedule_booking_conflicts(uuid, date, date)
  set search_path = '';

alter function public.apply_booking_closeout_rules(uuid)
  set search_path = '';

alter function public.respond_to_owned_review(uuid, text)
  set search_path = '';
