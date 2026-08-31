-- Phase 17: harden Provider self-service/onboarding SECURITY DEFINER RPC search paths.
--
-- These public RPCs are intentionally callable by authenticated users because the application
-- invokes them through session-bound Customer/Provider Supabase server clients. Each function
-- performs its own authentication plus applicant/provider ownership and lifecycle-state checks
-- before privileged reads or mutations, so authenticated/service-role EXECUTE grants remain
-- unchanged.
--
-- Every application-owned relation/helper referenced by these functions is already explicitly
-- schema-qualified (public.* / auth.*). Pinning search_path to the empty path therefore removes
-- dependence on the exposed public schema without changing RPC signatures, grants, authorization
-- semantics, onboarding/verification/setup behavior, or return contracts.
--
-- Anonymous execution remains denied. Cashfree, payment, refund, payout, recovery, and finance
-- functions/policies are untouched.

alter function public.submit_provider_application(text, text, text, text)
  set search_path = '';

alter function public.withdraw_provider_application(uuid)
  set search_path = '';

alter function public.submit_provider_verification(text, text, text, text, text, text)
  set search_path = '';

alter function public.withdraw_provider_verification(uuid)
  set search_path = '';

alter function public.submit_service_launch_request(uuid, uuid, uuid, uuid)
  set search_path = '';

alter function public.withdraw_service_launch_request(uuid)
  set search_path = '';

alter function public.update_provider_profile(text, text, text)
  set search_path = '';

alter function public.get_provider_setup_readiness()
  set search_path = '';

alter function public.get_provider_launch_options()
  set search_path = '';

alter function public.get_my_provider_trust_state()
  set search_path = '';
