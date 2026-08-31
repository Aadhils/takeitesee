-- Phase 17: harden privileged provider Admin SECURITY DEFINER RPC search paths.
--
-- These six public RPCs are intentionally callable by authenticated users because the app invokes
-- them through the session-bound Supabase server client. Each function performs its own
-- Admin/Super Admin authorization before privileged reads or mutations, so authenticated EXECUTE
-- is retained.
--
-- Their bodies already schema-qualify all application-owned relations, types, and helper functions.
-- Pinning search_path to the empty path therefore removes dependence on the exposed public schema
-- without changing RPC signatures, grants, authorization semantics, or business behavior.
-- PostgreSQL still resolves built-in pg_catalog functions implicitly.
--
-- Cashfree, payment, refund, payout, recovery, and finance functions/policies are untouched.

alter function public.list_provider_trust_overview()
  set search_path = '';

alter function public.review_provider_application(uuid, text, text)
  set search_path = '';

alter function public.review_provider_verification(uuid, text, text)
  set search_path = '';

alter function public.review_service_launch_request(uuid, text, text)
  set search_path = '';

alter function public.revoke_provider_verification(text, uuid, text)
  set search_path = '';

alter function public.set_provider_trust_state(text, uuid, text, text)
  set search_path = '';
