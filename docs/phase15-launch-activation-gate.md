# Phase 15 launch activation gate

Last consolidated: 2026-09-02 (Asia/Kolkata), after PR `#198` production verification.

This document is the current TakeItEsee public-launch readiness gate. Real customer payments, Cashfree behavior, refunds, payouts, recovery, settlement, reconciliation, cash collection, disputes/chargebacks, and INR finance activation remain explicitly **HOLD**. Launch-readiness work must not activate or alter that scope indirectly.

## Current production baseline

- Canonical public domain: `https://www.takeitesee.com`.
- Apex domain: `https://takeitesee.com`.
- Canonical production Supabase project: `bukrpkymivkhdpueropt`.
- Vercel production project: `prj_tnzTyndMigNpGqH1x0SZ2sRpAUlf`.
- Current audited production release before this documentation-only consolidation: `156ba88606cfdeacbc751d9632b1bd9d878a5d10`.
- Current audited Vercel deployment before this documentation-only consolidation: `dpl_B4nmJ7wsRZLuV2VaEcCHMJ8aKuhW`.
- That deployment is `READY`, carries both canonical domains, and its Git SHA exactly matches the audited release.
- `GET /api/health` returned HTTP `200`, `status=ok`, `app=ok`, `database=ok`, release `156ba88606cf`.
- Post-release runtime verification returned zero runtime errors and zero deployment-scoped `5xx` entries in the verification window.
- Vercel reported zero unresolved toolbar-feedback threads for the production project during the same closure.

The release produced by the PR that updates this file must independently pass the same exact-SHA deployment, canonical-health, runtime, 5xx, and feedback closure before it becomes the new authoritative baseline.

## Verified green non-finance gates

The implemented non-finance candidate has production-verified coverage for:

- canonical domain and production-environment integrity,
- public discovery and private/auth boundaries,
- real HTTP 404 and global error recovery,
- Supabase RLS/RPC authorization hardening and non-finance index readiness,
- signup/email confirmation/password recovery/account security/email change,
- 18+ and Terms/Privacy consent recording,
- approved Privacy Policy, Terms of Service, and Cookie Policy,
- approved TakeItEsee favicon/PWA/Apple-touch/social identity,
- provider legal/public-contact/grievance disclosure before verification/publication,
- signed-in privacy request submission/history/review,
- signed-in platform support/grievance submission/history/review,
- direct privacy/support status-notification routing,
- keyboard skip-navigation accessibility support,
- production incident-response/rollback procedure,
- production data-recovery readiness procedure,
- production monitoring/observability operator baseline.

The INR finance policy remains inactive.

## Launch-readiness production closures

The core production closures through PR `#193` established auth, reliability, database hardening, legal, brand, privacy, account-security, support/grievance, and request-status-notification readiness.

The final operational-readiness layer then added:

- PR `#194`: post-application launch-readiness operational closure work.
- PR `#195`: production incident response and rollback runbook.
- PR `#196`: keyboard skip navigation / main-content bypass accessibility support.
- PR `#197`: production data recovery readiness runbook, including database-vs-Storage recovery boundaries and plan-safe restore guidance.
- PR `#198`: production monitoring and observability runbook with canonical health/runtime/5xx/release-integrity signals and escalation guidance.
- Current consolidation: final go-live operator checklist plus refreshed single-source launch gate.

All of these closures preserve the Finance/Cashfree HOLD boundary and do not enable Supabase Pro-only leaked-password protection.

## Final non-finance candidate state

The TakeItEsee non-finance application candidate is production-smoke clean at the last audited release and has the operational documentation needed for release integrity, incident response, recovery, monitoring, and go-live handoff.

Use `docs/production-go-live-operator-checklist.md` as the release-day execution checklist. A release is not closed merely because a PR merged; it must be tied to the exact production deployment and pass canonical health/runtime verification.

### Current non-finance classification

**Application implementation:** launch candidate / production-smoke clean.

**Operational readiness:** incident response, recovery, monitoring, and go-live procedures documented.

**External plan-level security item:** Supabase leaked-password protection remains HOLD until Pro upgrade and explicit resume instruction.

This plan-level HOLD must be represented accurately; it does not authorize unrelated application churn or a paid upgrade.

## Remaining non-finance external gate — HOLD

### Supabase leaked-password protection

The Supabase Security Advisor reports leaked-password protection as disabled. Dashboard review previously confirmed that `Prevent use of leaked passwords` requires the Supabase Pro plan or above and is unavailable on the current plan.

The application and Supabase email provider enforce an 8-character minimum password, but leaked-password screening remains an external plan-level gate. Do not represent this item as green until:

1. the canonical Supabase project is upgraded to a plan exposing the setting,
2. the product owner explicitly resumes this HOLD work,
3. `Prevent use of leaked passwords` is enabled in Supabase Auth, and
4. a fresh Security Advisor audit confirms the leaked-password warning is cleared.

Do not upgrade, purchase, or enable a paid capability merely to make launch-readiness evidence green.

## Intentional Supabase advisor notices

Some SECURITY DEFINER notices remain intentional where functions are required for public marketplace availability, RLS policy evaluation, or authenticated application workflows. Prior live definition review confirmed fixed/empty search paths and explicit ownership, participant, scoped-admin, or Super Admin authorization context for the audited functions.

Do not blindly revoke authenticated grants from privileged RPCs solely because an advisor labels them SECURITY DEFINER. Review the function definition and authorization boundary in context.

Finance/payment/payout/refund/recovery/settlement/reconciliation-related advisor notices remain inside the explicit Finance/Cashfree HOLD boundary and are not non-finance launch-readiness change targets.

## Deferred finance-only privileged readiness

`GET /api/super-admin/readiness` is a Super Admin-only finance-readiness surface combining database/security probes with Cashfree Payments, Cashfree Payouts, sandbox-payment evidence, and INR finance-policy state. Guest access must continue to fail closed without privileged readiness details.

A full privileged finance-readiness run is intentionally deferred until Finance/Cashfree HOLD is explicitly lifted. Do not create or elevate a privileged identity, expose a service-role key, activate gateway credentials, or run payment/payout E2E merely to make this finance-only panel green.

## Finance / Cashfree / payment HOLD

Cashfree, payment, cash collection, refunds, payouts, disputes/chargebacks, recovery, settlement, reconciliation, and INR finance behavior remain **HOLD**.

Do not:

- activate Cashfree sandbox or production credentials,
- change payment/refund/payout/recovery/settlement/reconciliation behavior,
- change finance policies, functions, indexes, state machines, or activation flags,
- run payment/refund/payout/dispute/recovery end-to-end scenarios,
- enable INR finance policy,
- represent finance readiness as green based on non-finance launch evidence.

Resume finance work only after the HOLD is explicitly lifted in a later instruction.

## Final release-day source of truth

For every production go-live or subsequent release, use `docs/production-go-live-operator-checklist.md` and record:

- PR number,
- authoritative merged `main` SHA,
- exact Vercel production deployment ID,
- required `web` CI / Type check / Lint / Production build result,
- canonical `/api/health` result and release prefix,
- runtime error result,
- deployment-scoped 5xx result,
- unresolved Vercel feedback result,
- canonical Supabase health/advisor evidence where relevant,
- intentional/deferred warnings,
- Finance/Cashfree HOLD status,
- Supabase Pro/leaked-password HOLD status.

Never record credentials, service-role keys, auth tokens, sensitive PII, or raw production database dumps in launch evidence.

## Production activation remains separate

Public non-finance launch readiness and finance activation are separate programs. Clearing website, security, reliability, SEO, auth, accessibility, brand, legal, repository-governance, privacy/support, incident-response, recovery, monitoring, or go-live gates must never activate payment or finance behavior indirectly.

The non-finance application can be declared GO only when the current release independently satisfies the final operator checklist. Finance remains NO-GO/HOLD until explicitly resumed.
