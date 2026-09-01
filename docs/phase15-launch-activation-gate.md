# Phase 15 launch activation gate

Last audited: 2026-09-01 (Asia/Kolkata)

This gate records the current TakeItEsee public-launch readiness state. Real customer payments, Cashfree behavior, refunds, payouts, recovery, settlement, reconciliation, and INR finance activation remain explicitly **HOLD** and must not be changed or activated as a side effect of launch-readiness work.

## Current production baseline

- Canonical public domain: `https://www.takeitesee.com`.
- Canonical production Supabase project: `bukrpkymivkhdpueropt`.
- Current audited production release: `f0f42a6eb92749a64537884b0832671eb738e9f5`.
- Current audited Vercel deployment: `dpl_5FSsypwb8tSc8GHDrHMVzoPJiyhg`.
- `GET /api/health` returned `status=ok`, `app=ok`, `database=ok`, release `f0f42a6eb927`.
- Final deployment-scoped runtime verification after representative auth smoke traffic returned zero `error`/`fatal` entries and zero `5xx` entries.

## Verified green gates

- `takeitesee.com` / `www.takeitesee.com` use the canonical Supabase project `bukrpkymivkhdpueropt`.
- Sitemap, robots, canonical-domain, and public/private indexability audits are clean.
- Public discovery routes use indexable canonical metadata; private/account/provider workflow surfaces use `noindex`/`nofollow` and `X-Robots-Tag` protections where applicable.
- Representative production smoke checks for home, explore, categories, login, provider onboarding, guest bookings, 404 recovery, password-recovery pages, email-confirmation failure handling, and `/api/health` completed without production runtime errors.
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
- Production signup is session-aware: when Supabase requires email confirmation and returns `session=null`, the app does not send the user into an unauthenticated account redirect loop.
- Production password-recovery UX exists at `/forgot-password` and `/reset-password`, with no-store/noindex protections and generic reset-request copy that avoids account enumeration.
- Production signup email-confirmation callback support exists at `/auth/confirm` for the documented Supabase token-hash `type=email` flow. Missing, unsupported, invalid, or failed confirmation requests fail closed without leaking token values or raw Supabase errors.
- Invalid/expired email-confirmation links land on the private login surface with visible English/Tamil guidance.
- INR finance policy remains inactive.

## Production closures completed during Launch Readiness

- PR `#163`: production auth/return-path closure; exact deployment runtime `error/fatal = 0`, `5xx = 0`.
- PR `#164`: root-level global error fallback; CI green and production runtime clean.
- PR `#165`: 17 non-finance Provider onboarding/verification/trust/service-launch foreign-key indexes; canonical production migration applied and verified.
- PR `#166`: 4 core marketplace event/history foreign-key indexes; canonical production migration applied and verified.
- PR `#167`: 6 Admin control-plane foreign-key indexes; canonical production migration applied and verified.
- PR `#168`: refreshed launch-gate evidence after the non-finance FK-index closure.
- PR `#169`: made production signup aware of pending email confirmation and preserved the return path for the later sign-in step.
- PR `#170`: added production Supabase password-recovery request/update flow and private recovery routes.
- PR `#171`: corrected password-recovery page metadata titles while preserving private/noindex behavior.
- PR `#172`: added the secure Supabase SSR `/auth/confirm` token-hash email-confirmation route; exact deployment runtime `error/fatal = 0`, `5xx = 0`.
- PR `#173`: added safe bilingual invalid/expired confirmation-link guidance on the login surface; exact deployment runtime `error/fatal = 0`, `5xx = 0`.

All of these closures preserved the Finance/Cashfree HOLD boundary.

## Intentional Supabase Security Advisor warnings

A small set of anonymous SECURITY DEFINER warnings remains intentionally where functions are required by public marketplace availability or RLS policy evaluation. Signed-in SECURITY DEFINER warnings also remain for authenticated customer/provider/admin workflows.

Live function-definition review previously confirmed the audited functions use an empty fixed search path and explicit ownership, participant, scoped Admin, or Super Admin authorization checks. Removing the `authenticated` grant solely to silence the Advisor would break legitimate application workflows and is not part of this hardening step.

Fresh Security Advisor review on 2026-09-01 also continues to report finance/payment/payout/recovery-related notices. Those items remain inside the explicit Finance/Cashfree HOLD boundary and are not launch-readiness change targets.

## Remaining non-finance launch blockers

### 1. Supabase leaked-password protection

The Supabase Security Advisor reports leaked-password protection as disabled. Supabase documents this as an Auth setting that rejects passwords known to have appeared in public password leaks.

Enable leaked-password protection in the canonical production project's Authentication settings before public launch, then re-run the Security Advisor. The connected Supabase capability available during this audit can inspect the project and database but does not expose a safe Auth-configuration write action, so no workaround was applied through SQL.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. Hosted Supabase Auth configuration and real-email E2E

The application code path is now ready for signup confirmation and password recovery, but hosted Supabase Auth configuration still requires direct dashboard verification before this gate can be called green.

Verify all of the following in the canonical production project:

- canonical Site URL points to the production TakeItEsee origin,
- allowed redirect URLs include the exact required production callback/recovery destinations and do not include unnecessary broad origins,
- the signup-confirmation email template uses the Supabase SSR-compatible token-hash confirmation link that reaches `/auth/confirm` with `token_hash` and `type=email`,
- SMTP/email delivery configuration is production-ready,
- a real new-user signup receives the confirmation email and completes `signup -> email -> /auth/confirm -> authenticated account`,
- a real password-reset request receives the recovery email and completes `forgot password -> recovery email -> /reset-password -> password update`.

Do not mark these items green from code inspection alone. The connected Supabase capability used for this audit does not expose the hosted Auth email-template/Site URL/redirect-list/SMTP configuration writes needed to complete or prove this external gate.

### 3. GitHub `main` branch protection

`main` currently reports `protected=false`, with required status checks not enforced at branch level.

Before public launch, protect `main` so routine production changes require a pull request and the permanent `Web CI` check. The connected GitHub capability can verify the current branch state but does not expose a branch-protection/ruleset write action in this workflow, so this remains an explicit repository-settings gate.

### 4. Final square brand asset

Favicon, web-app manifest icons, and social-image work remain blocked because a proper approved square TakeItEsee brand asset has not been supplied. Do not invent, crop, redraw, or substitute a brand mark merely to clear this gate.

### 5. Final legal policy text

Privacy Policy, Terms of Service, and Cookie Policy remain blocked pending approved legal text. Current product UI intentionally indicates that legal policy documents are being finalized. Do not fabricate legal terms to clear this gate.

### 6. Privileged server configuration confirmation

Use the Super Admin launch-readiness panel/API with a real Super Admin session to verify server-side Supabase service-role access and configuration state. Guest access is expected to fail closed. Never expose, print, commit, or return the service-role key itself.

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

Public non-finance launch readiness and finance activation are separate gates. Clearing website, security, reliability, SEO, auth, brand, legal, or repository-governance blockers must never activate payment or finance behavior indirectly.

## Super Admin readiness endpoint

`GET /api/super-admin/readiness` is Super Admin-only and reports booleans/configuration state without returning secret values or database rows. Guest access correctly returns an authorization failure instead of readiness details. It checks:

- canonical Supabase binding,
- service-role database access,
- RPC hardening state,
- public marketplace helper availability,
- INR finance policy activation state,
- Cashfree Payments mode/configuration completeness,
- Cashfree Payouts mode/configuration completeness.

Finance-related readiness fields are observational only while Finance/Cashfree remains HOLD.
