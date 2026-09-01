# Phase 15 launch activation gate

Last audited: 2026-09-01 (Asia/Kolkata)

This gate records the current TakeItEsee public-launch readiness state. Real customer payments, Cashfree behavior, refunds, payouts, recovery, settlement, reconciliation, and INR finance activation remain explicitly **HOLD** and must not be changed or activated as a side effect of launch-readiness work.

## Current production baseline

- Canonical public domain: `https://www.takeitesee.com`.
- Canonical production Supabase project: `bukrpkymivkhdpueropt`.
- Current audited production release: `2259ae18557a61ae63cc988a20f6f2f800ca35f8`.
- Current audited Vercel deployment: `dpl_9ZSiU4MRpk5yQJBfCUxu5nrvjefG`.
- `GET /api/health` returned `status=ok`, `app=ok`, `database=ok`, release `2259ae18557a`.
- Final deployment-scoped runtime verification after representative smoke traffic returned zero `error`/`fatal` entries and zero `5xx` entries.

## Verified green gates

- `takeitesee.com` / `www.takeitesee.com` use the canonical Supabase project `bukrpkymivkhdpueropt`.
- Sitemap, robots, canonical-domain, and public/private indexability audits are clean.
- Public discovery routes use indexable canonical metadata; private/account/provider workflow surfaces use `noindex`/`nofollow` and `X-Robots-Tag` protections where applicable.
- Representative production smoke checks for home, explore, categories, login, provider onboarding, guest bookings, 404 recovery, and `/api/health` completed without production runtime errors.
- Unknown routes return a real HTTP `404` with branded recovery UI and automatic `noindex` behavior.
- Root-level application failures have a self-contained `global-error.tsx` recovery fallback with retry/home actions.
- Anonymous execution was removed from mutating and user-specific SECURITY DEFINER RPCs.
- Trigger-only SECURITY DEFINER functions are no longer directly executable by `anon` or `authenticated` API roles.
- Required anonymous marketplace/RLS helpers remain available.
- Audited authenticated customer/provider RPCs use `auth.uid()` plus ownership/participant authorization context.
- Audited Admin/Super Admin RPCs use explicit scoped manage or Super Admin authorization checks, including self-action protections where required.
- A fresh unprivileged authenticated identity receives no Admin/Super Admin/platform-manage authority.
- Provider and platform-manage test identities are separated in the current live data footprint.
- Provider onboarding, core marketplace event/history, and Admin control-plane non-finance foreign-key relationships now have covering indexes.
- Live catalog verification reports **zero remaining unindexed non-finance foreign keys**. Remaining unindexed foreign keys belong only to finance/payment/refund/payout/recovery/settlement HOLD scope and are intentionally untouched.
- INR finance policy remains inactive.

## Production closures completed during Launch Readiness

- PR `#163`: production auth/return-path closure; exact deployment runtime `error/fatal = 0`, `5xx = 0`.
- PR `#164`: root-level global error fallback; CI green and production runtime clean.
- PR `#165`: 17 non-finance Provider onboarding/verification/trust/service-launch foreign-key indexes; canonical production migration applied and verified.
- PR `#166`: 4 core marketplace event/history foreign-key indexes; canonical production migration applied and verified.
- PR `#167`: 6 Admin control-plane foreign-key indexes; canonical production migration applied and verified.

All of these closures preserved the Finance/Cashfree HOLD boundary.

## Intentional Supabase Security Advisor warnings

A small set of anonymous SECURITY DEFINER warnings remains intentionally because the functions are required by public marketplace availability or RLS policy evaluation:

- `get_public_booking_conflicts`
- `provider_owner_is_verified`
- `provider_profile_is_complete`
- `provider_trust_allows_marketplace`
- `service_scope_is_launchable`

Signed-in SECURITY DEFINER warnings also remain for authenticated customer/provider/admin workflows. Live function-definition review confirms the audited functions use an empty fixed search path and explicit ownership, participant, scoped Admin, or Super Admin authorization checks. Removing the `authenticated` grant solely to silence the Advisor would break legitimate application workflows and is not part of this hardening step.

## Remaining non-finance launch blockers

### 1. Supabase leaked-password protection

The Supabase Security Advisor reports leaked-password protection as disabled. Supabase documents this as an Auth setting that rejects passwords known to have appeared in public password leaks.

Enable leaked-password protection in the canonical production project's Authentication settings before public launch, then re-run the Security Advisor. The connected Supabase capability available during this audit can inspect the project and database but does not expose a safe Auth-configuration write action, so no workaround was applied through SQL.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. GitHub `main` branch protection

`main` currently reports `protected=false`, with required status checks not enforced at branch level.

Before public launch, protect `main` so routine production changes require a pull request and the permanent `Web CI` check. The connected GitHub capability can verify the current branch state but does not expose a branch-protection/ruleset write action in this workflow, so this remains an explicit repository-settings gate.

### 3. Final square brand asset

Favicon, web-app manifest icons, and social-image work remain blocked because a proper approved square TakeItEsee brand asset has not been supplied. Do not invent, crop, redraw, or substitute a brand mark merely to clear this gate.

### 4. Final legal policy text

Privacy Policy, Terms of Service, and Cookie Policy remain blocked pending approved legal text. Current product UI intentionally indicates that legal policy documents are being finalized. Do not fabricate legal terms to clear this gate.

### 5. Privileged server configuration confirmation

Use the Super Admin launch-readiness panel/API to verify server-side Supabase service-role access and configuration state. Never expose, print, commit, or return the service-role key itself.

## Finance / Cashfree / payment HOLD

Cashfree, payment, cash collection, refunds, payouts, disputes/chargebacks, recovery, settlement, reconciliation, and INR finance behavior are **not part of the current autonomous launch-readiness tranche**.

Do not:

- activate Cashfree sandbox or production credentials,
- change payment/refund/payout/recovery/settlement behavior,
- change finance policies, functions, indexes, state machines, or activation flags,
- run payment/refund/payout end-to-end scenarios,
- enable INR finance policy.

Resume finance work only after the HOLD is explicitly lifted in a later instruction.

## Production activation remains separate

Public non-finance launch readiness and finance activation are separate gates. Clearing website, security, reliability, SEO, brand, legal, or repository-governance blockers must never activate payment or finance behavior indirectly.

## Super Admin readiness endpoint

`GET /api/super-admin/readiness` is Super Admin-only and reports booleans/configuration state without returning secret values or database rows. It checks:

- canonical Supabase binding,
- service-role database access,
- RPC hardening state,
- public marketplace helper availability,
- INR finance policy activation state,
- Cashfree Payments mode/configuration completeness,
- Cashfree Payouts mode/configuration completeness.

Finance-related readiness fields are observational only while Finance/Cashfree remains HOLD.
