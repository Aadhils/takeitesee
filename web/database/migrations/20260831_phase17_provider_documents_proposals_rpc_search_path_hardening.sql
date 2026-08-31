-- Phase 17: harden Provider verification-document and requirement-proposal SECURITY DEFINER RPC search paths.
--
-- These public RPCs are intentionally callable by authenticated application sessions. The
-- provider-facing routes require an authenticated Provider before invoking upload/delete/lead/
-- proposal operations, while the verification-document access audit route requires Admin access.
-- Each function also repeats its own auth.uid(), applicant/provider ownership, lifecycle-state,
-- service-match, or Admin/Super Admin checks inside the database before privileged work.
--
-- Every application-owned relation/helper reference is already explicitly schema-qualified
-- (public.*, auth.*, storage.*). Pinning search_path to the empty path therefore removes reliance
-- on mutable public/storage search paths without changing RPC signatures, grants, authorization
-- semantics, Storage object rules, proposal workflow behavior, or return contracts.
--
-- Anonymous execution remains denied. Cashfree, payment, refund, payout, recovery, and finance
-- functions/policies are untouched.

alter function public.register_provider_verification_document(uuid, text, text)
  set search_path = '';

alter function public.record_provider_verification_document_access(uuid)
  set search_path = '';

alter function public.mark_provider_verification_document_deleted(uuid)
  set search_path = '';

alter function public.get_provider_requirement_leads()
  set search_path = '';

alter function public.provider_submit_requirement_proposal(uuid, uuid, bigint, text, date)
  set search_path = '';

alter function public.provider_withdraw_requirement_proposal(uuid)
  set search_path = '';
