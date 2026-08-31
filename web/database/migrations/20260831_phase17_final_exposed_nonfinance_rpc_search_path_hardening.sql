-- Phase 17: harden the remaining exposed non-finance SECURITY DEFINER RPC search paths.
--
-- Audited live on the canonical production database before this migration:
-- - get_public_booking_conflicts(text, uuid, date, date) is an intentional anonymous/public availability RPC.
-- - get_service_launch_review_queue() is an intentional authenticated Admin review RPC.
-- - update_marketplace_issue(uuid, text, text) is an intentional authenticated scoped-Admin workflow RPC.
--
-- Their application callers and database bodies preserve the intended authorization model, and every
-- application-owned relation/type/helper reference is explicitly schema-qualified. Pinning search_path to
-- the empty path therefore removes mutable public/pg_temp lookup without changing RPC signatures, EXECUTE
-- grants, public availability behavior, Admin scope checks, support-case state transitions, or notifications.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation logic/configuration are
-- intentionally untouched by this migration.

alter function public.get_public_booking_conflicts(text, uuid, date, date)
  set search_path = '';

alter function public.get_service_launch_review_queue()
  set search_path = '';

alter function public.update_marketplace_issue(uuid, text, text)
  set search_path = '';
