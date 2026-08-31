-- Phase 17: harden Customer requirement lifecycle SECURITY DEFINER RPC search paths.
--
-- These public RPCs are intentionally callable by authenticated Customer application sessions.
-- The Next.js routes require a Customer session before invoking them, and each function repeats
-- its own auth.uid(), customer ownership, proposal ownership/lifecycle, accepted-proposal, service,
-- availability, and booking-conflict checks before privileged work.
--
-- Every application-owned relation/helper reference in these function bodies is already schema-
-- qualified (public.* / auth.*). Pinning search_path to the empty path therefore removes reliance
-- on the mutable public search path without changing RPC signatures, EXECUTE grants, ownership
-- semantics, proposal decisions, requirement state transitions, job conversion, or return contracts.
--
-- Anonymous execution remains denied. Cashfree, payment, refund, payout, recovery, and finance
-- activation functions/policies are untouched.

alter function public.create_customer_requirement(text, uuid, uuid, text, text, text, text, bigint, bigint, text, date)
  set search_path = '';

alter function public.customer_update_requirement_status(uuid, text)
  set search_path = '';

alter function public.get_customer_requirement_proposals(uuid)
  set search_path = '';

alter function public.customer_decide_requirement_proposal(uuid, text)
  set search_path = '';

alter function public.customer_create_requirement_job(uuid, date, time without time zone, text)
  set search_path = '';

alter function public.get_requirement_job_history(uuid)
  set search_path = '';
