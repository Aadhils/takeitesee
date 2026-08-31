-- Phase 17: harden Marketplace Messaging & Moderation SECURITY DEFINER RPC search paths.
--
-- These public RPCs are intentionally callable by authenticated users because the application
-- invokes them through session-bound Supabase server clients. Each function performs its own
-- authentication plus participant/ownership/Admin authorization checks before privileged reads
-- or mutations, so authenticated/service-role EXECUTE grants remain unchanged.
--
-- Every application-owned relation/helper referenced by these functions is already explicitly
-- schema-qualified (public.*, private.*, auth.*). Pinning search_path to the empty path therefore
-- removes dependence on the exposed public schema without changing RPC signatures, grants,
-- authorization semantics, message/moderation behavior, or return contracts.
--
-- Anonymous execution remains denied. Cashfree, payment, refund, payout, recovery, and finance
-- functions/policies are untouched.

alter function public.get_marketplace_inbox()
  set search_path = '';

alter function public.get_marketplace_conversation(uuid)
  set search_path = '';

alter function public.get_marketplace_conversation_safety(uuid)
  set search_path = '';

alter function public.send_marketplace_message(uuid, text, text)
  set search_path = '';

alter function public.mark_marketplace_conversation_read(uuid)
  set search_path = '';

alter function public.set_marketplace_conversation_block(uuid, boolean, text)
  set search_path = '';

alter function public.open_marketplace_moderation_report(text, uuid, text, text)
  set search_path = '';

alter function public.get_marketplace_moderation_queue()
  set search_path = '';

alter function public.admin_update_marketplace_moderation_report(uuid, text, text)
  set search_path = '';
